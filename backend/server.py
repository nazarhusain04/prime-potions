from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, WebSocket, WebSocketDisconnect, Query, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import json
import asyncio
import io
import re

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Settings
JWT_SECRET = os.environ.get('JWT_SECRET')
if not JWT_SECRET:
    raise RuntimeError(
        "JWT_SECRET environment variable must be set (no default — this repo is public). "
        "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
    )
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Only company email addresses may be granted accounts - set via env if the domain changes.
ALLOWED_USER_EMAIL_DOMAIN = os.environ.get('ALLOWED_USER_EMAIL_DOMAIN', 'primepotions.com').lower()

# Create the main app
app = FastAPI(title="Prime Potions ERP API", redirect_slashes=False)

# Create routers
api_router = APIRouter(prefix="/api")
auth_router = APIRouter(prefix="/auth", tags=["Authentication"])
users_router = APIRouter(prefix="/users", tags=["Users"])
settings_router = APIRouter(prefix="/settings", tags=["Settings"])
master_router = APIRouter(prefix="/master", tags=["Master Data"])
inventory_router = APIRouter(prefix="/inventory", tags=["Inventory"])
manufacturing_router = APIRouter(prefix="/manufacturing", tags=["Manufacturing"])
traceability_router = APIRouter(prefix="/traceability", tags=["Traceability"])
excel_router = APIRouter(prefix="/excel", tags=["Excel Sync"])
batching_router = APIRouter(prefix="/batching", tags=["Batching Workspace"])
formulas_router = APIRouter(prefix="/formulas", tags=["Formulas/BOM"])

# Security
security = HTTPBearer()

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections[:]:
            try:
                await connection.send_json(message)
            except:
                self.disconnect(connection)

manager = ConnectionManager()

# ============ PYDANTIC MODELS ============

# Auth Models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str = "Viewer"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None

# Company Settings
class CompanySettingsModel(BaseModel):
    company_name: str = "Prime Potions"
    legal_name: str = "Prime Potions LLC"
    address: str = ""
    phone: str = ""
    email: str = ""
    logo_url: str = "/assets/prime-potions-logo.svg"
    primary_color: str = "#0F5132"
    timezone: str = "UTC"
    lot_number_format: str = "YYMMDD-SEQ"

class CompanySettingsUpdate(BaseModel):
    company_name: Optional[str] = None
    legal_name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    timezone: Optional[str] = None
    lot_number_format: Optional[str] = None

# Unit of Measure
class UnitOfMeasureCreate(BaseModel):
    code: str
    name: str
    category: str  # weight, volume, count
    base_unit: Optional[str] = None
    conversion_factor: float = 1.0

class UnitOfMeasureResponse(BaseModel):
    id: str
    code: str
    name: str
    category: str
    base_unit: Optional[str]
    conversion_factor: float

# Location
class LocationCreate(BaseModel):
    code: str
    name: str
    type: str  # warehouse, production, quarantine, shipping

class LocationResponse(BaseModel):
    id: str
    code: str
    name: str
    type: str
    is_active: bool

# Raw Material
class RawMaterialCreate(BaseModel):
    sku: str
    name: str
    description: Optional[str] = ""
    unit_of_measure: str
    reorder_point: float = 0
    category: Optional[str] = ""

class RawMaterialResponse(BaseModel):
    id: str
    sku: str
    name: str
    description: str
    unit_of_measure: str
    reorder_point: float
    category: str
    is_active: bool

# Packaging Material
class PackagingMaterialCreate(BaseModel):
    sku: str
    name: str
    description: Optional[str] = ""
    unit_of_measure: str
    reorder_point: float = 0
    category: Optional[str] = ""

class PackagingMaterialResponse(BaseModel):
    id: str
    sku: str
    name: str
    description: str
    unit_of_measure: str
    reorder_point: float
    category: str
    is_active: bool

# Product (Finished Goods)
class ProductCreate(BaseModel):
    sku: str
    name: str
    description: Optional[str] = ""
    unit_of_measure: str
    category: Optional[str] = ""

class ProductResponse(BaseModel):
    id: str
    sku: str
    name: str
    description: str
    unit_of_measure: str
    category: str
    is_active: bool

# Recipe / BOM
class RecipeIngredient(BaseModel):
    material_id: str
    material_type: str  # raw_material
    quantity: float
    unit_of_measure: str

class FillingComponent(BaseModel):
    material_id: str
    material_type: str  # packaging_material
    quantity: float
    unit_of_measure: str

class RecipeCreate(BaseModel):
    product_id: str
    name: str
    batch_size: float
    batch_unit: str
    ingredients: List[RecipeIngredient]
    filling_components: List[FillingComponent]
    batch_yield_loss_percent: float = 2.0
    filling_yield_loss_percent: float = 1.0
    version: str = "1.0"
    effective_date: Optional[str] = None

class RecipeResponse(BaseModel):
    id: str
    product_id: str
    name: str
    batch_size: float
    batch_unit: str
    ingredients: List[dict]
    filling_components: List[dict]
    batch_yield_loss_percent: float
    filling_yield_loss_percent: float
    version: str
    effective_date: str
    is_active: bool

# Inventory Transaction (Ledger Entry)
class InventoryTransactionCreate(BaseModel):
    item_id: str
    item_type: str  # raw_material, packaging_material, wip_batch, finished_good
    lot_number: str
    location_id: str
    transaction_type: str  # receive, issue, produce, adjust, transfer, scrap
    quantity: float
    unit_of_measure: str
    reference_type: Optional[str] = None  # batch_order, filling_order, purchase_order
    reference_id: Optional[str] = None
    status: str = "Available"  # Available, Reserved, Quarantine, Scrap
    notes: Optional[str] = ""

class InventoryTransferRequest(BaseModel):
    item_id: str
    item_type: str
    lot_number: str
    from_location_id: str
    to_location_id: str
    quantity: float
    notes: Optional[str] = ""

class InventoryTransactionResponse(BaseModel):
    id: str
    item_id: str
    item_type: Optional[str] = None
    lot_number: str
    location_id: Optional[str] = None
    transaction_type: str
    quantity: float
    unit_of_measure: str
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    status: Optional[str] = "Available"
    notes: Optional[str] = ""
    created_at: str
    created_by: str

# Stock Snapshot
class StockSnapshotResponse(BaseModel):
    item_id: str
    item_type: str
    lot_number: str
    location_id: str
    quantity_on_hand: float
    quantity_available: float
    quantity_reserved: float
    status: str
    unit_of_measure: str

# Batch Order
class BatchOrderCreate(BaseModel):
    recipe_id: str
    planned_quantity: float
    target_location_id: str
    notes: Optional[str] = ""

class BatchOrderResponse(BaseModel):
    id: str
    batch_number: str
    recipe_id: str
    product_id: str
    planned_quantity: float
    actual_quantity: Optional[float]
    target_location_id: str
    status: str
    notes: str
    created_at: str
    completed_at: Optional[str]

class BatchConsumptionCreate(BaseModel):
    batch_order_id: str
    material_id: str
    lot_number: str
    quantity: float

# Filling Order
class FillingOrderCreate(BaseModel):
    product_id: str
    recipe_id: str
    planned_quantity: float
    target_location_id: str
    notes: Optional[str] = ""

class FillingOrderResponse(BaseModel):
    id: str
    filling_number: str
    product_id: str
    recipe_id: str
    planned_quantity: float
    actual_quantity: Optional[float]
    target_location_id: str
    status: str
    notes: str
    created_at: str
    completed_at: Optional[str]

class FeasibilityResponse(BaseModel):
    product_id: str
    max_feasible_quantity: float
    quantity_label: str = "units"
    bottleneck: str
    components: List[dict]

# ============ HELPER FUNCTIONS ============

def generate_id():
    return str(uuid.uuid4())

def get_timestamp():
    return datetime.now(timezone.utc).isoformat()

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_roles(allowed_roles: List[str]):
    async def role_checker(user: dict = Depends(get_current_user)):
        if user["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return role_checker

async def generate_lot_number(prefix: str = ""):
    settings = await db.company_settings.find_one({}, {"_id": 0})
    format_str = settings.get("lot_number_format", "YYMMDD-SEQ") if settings else "YYMMDD-SEQ"
    
    today = datetime.now(timezone.utc)
    date_part = today.strftime("%y%m%d")
    
    # Get sequence for today
    seq_doc = await db.lot_sequences.find_one_and_update(
        {"date": date_part, "prefix": prefix},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True
    )
    seq = seq_doc.get("seq", 1)
    
    if prefix:
        return f"{prefix}-{date_part}-{seq:04d}"
    return f"{date_part}-{seq:04d}"

async def update_stock_snapshot(item_id: str, item_type: str, lot_number: str, location_id: str):
    """Recalculate stock snapshot from ledger transactions"""
    pipeline = [
        {"$match": {
            "item_id": item_id,
            "item_type": item_type,
            "lot_number": lot_number,
            "location_id": location_id
        }},
        {"$group": {
            "_id": {
                "item_id": "$item_id",
                "item_type": "$item_type",
                "lot_number": "$lot_number",
                "location_id": "$location_id",
                "status": "$status"
            },
            "total_quantity": {"$sum": "$quantity"},
            "unit_of_measure": {"$first": "$unit_of_measure"}
        }}
    ]
    
    results = await db.inventory_transactions.aggregate(pipeline).to_list(100)
    
    # Calculate totals
    quantity_on_hand = 0
    quantity_available = 0
    quantity_reserved = 0
    unit_of_measure = ""
    status = "Available"
    
    for r in results:
        qty = r["total_quantity"]
        unit_of_measure = r["unit_of_measure"]
        s = r["_id"]["status"]
        quantity_on_hand += qty
        if s == "Available":
            quantity_available += qty
        elif s == "Reserved":
            quantity_reserved += qty
        status = s
    
    if quantity_on_hand > 0:
        await db.stock_snapshots.update_one(
            {
                "item_id": item_id,
                "item_type": item_type,
                "lot_number": lot_number,
                "location_id": location_id
            },
            {"$set": {
                "quantity_on_hand": quantity_on_hand,
                "quantity_available": quantity_available,
                "quantity_reserved": quantity_reserved,
                "status": status,
                "unit_of_measure": unit_of_measure,
                "updated_at": get_timestamp()
            }},
            upsert=True
        )
    else:
        await db.stock_snapshots.delete_one({
            "item_id": item_id,
            "item_type": item_type,
            "lot_number": lot_number,
            "location_id": location_id
        })

async def create_audit_log(user_id: str, action: str, entity_type: str, entity_id: str, details: dict):
    log = {
        "id": generate_id(),
        "user_id": user_id,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "details": details,
        "created_at": get_timestamp()
    }
    await db.audit_logs.insert_one(log)

async def broadcast_update(event_type: str, data: dict):
    await manager.broadcast({"event": event_type, "data": data})

# ============ AUTH ROUTES ============

MAX_FAILED_LOGIN_ATTEMPTS = 5
LOGIN_LOCKOUT_MINUTES = 15

@auth_router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})

    if user and user.get("locked_until"):
        locked_until = datetime.fromisoformat(user["locked_until"])
        if locked_until > datetime.now(timezone.utc):
            raise HTTPException(status_code=429, detail=f"Too many failed attempts. Try again after {locked_until.strftime('%H:%M UTC')}.")

    if not user or not verify_password(credentials.password, user["password_hash"]):
        if user:
            attempts = user.get("failed_login_attempts", 0) + 1
            update = {"failed_login_attempts": attempts}
            if attempts >= MAX_FAILED_LOGIN_ATTEMPTS:
                update["locked_until"] = (datetime.now(timezone.utc) + timedelta(minutes=LOGIN_LOCKOUT_MINUTES)).isoformat()
                update["failed_login_attempts"] = 0
            await db.users.update_one({"email": credentials.email}, {"$set": update})
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Account disabled")

    if user.get("failed_login_attempts") or user.get("locked_until"):
        await db.users.update_one({"email": credentials.email}, {"$set": {"failed_login_attempts": 0, "locked_until": None}})

    token = create_token(user["id"], user["email"], user["role"])

    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            full_name=user["full_name"],
            role=user["role"],
            is_active=user.get("is_active", True),
            created_at=user["created_at"]
        )
    )

@auth_router.get("/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(
        id=user["id"],
        email=user["email"],
        full_name=user["full_name"],
        role=user["role"],
        is_active=user.get("is_active", True),
        created_at=user["created_at"]
    )

@auth_router.post("/change-password")
async def change_own_password(data: ChangePasswordRequest, user: dict = Depends(get_current_user)):
    """Let a logged-in user change their own password (requires their current password)."""
    full_user = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    if not full_user or not verify_password(data.current_password, full_user["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")

    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_password(data.new_password)}})
    await create_audit_log(user["id"], "change_password", "user", user["id"], {})
    return {"message": "Password updated"}

# ============ USER ROUTES ============

@users_router.post("", response_model=UserResponse)
async def create_user(data: UserCreate, user: dict = Depends(require_roles(["Admin"]))):
    """Create a new user account (Admin only). Restricted to company email addresses."""
    if not data.email.lower().endswith(f"@{ALLOWED_USER_EMAIL_DOMAIN}"):
        raise HTTPException(status_code=400, detail=f"Only @{ALLOWED_USER_EMAIL_DOMAIN} email addresses can be added")

    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    valid_roles = ["Admin", "Production", "Warehouse", "QA", "Viewer"]
    if data.role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {valid_roles}")

    new_user = {
        "id": generate_id(),
        "email": data.email,
        "password_hash": hash_password(data.password),
        "full_name": data.full_name,
        "role": data.role,
        "is_active": True,
        "created_at": get_timestamp()
    }
    await db.users.insert_one(new_user)
    await create_audit_log(user["id"], "create", "user", new_user["id"], {"email": data.email, "role": data.role})

    return UserResponse(**{k: v for k, v in new_user.items() if k != "password_hash"})

@users_router.get("", response_model=List[UserResponse])
async def list_users(user: dict = Depends(require_roles(["Admin"]))):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [UserResponse(**u) for u in users]

@users_router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, user: dict = Depends(require_roles(["Admin"]))):
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(**u)

@users_router.put("/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, update: UserUpdate, user: dict = Depends(require_roles(["Admin"]))):
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")

    if "password" in update_data:
        update_data["password_hash"] = hash_password(update_data.pop("password"))

    result = await db.users.find_one_and_update(
        {"id": user_id},
        {"$set": update_data},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="User not found")

    audit_data = {k: v for k, v in update_data.items() if k != "password_hash"}
    if "password_hash" in update_data:
        audit_data["password"] = "(changed)"
    await create_audit_log(user["id"], "update", "user", user_id, audit_data)

    return UserResponse(
        id=result["id"],
        email=result["email"],
        full_name=result["full_name"],
        role=result["role"],
        is_active=result.get("is_active", True),
        created_at=result["created_at"]
    )

# ============ COMPANY SETTINGS ROUTES ============

@settings_router.get("/company", response_model=CompanySettingsModel)
async def get_company_settings():
    settings = await db.company_settings.find_one({}, {"_id": 0})
    if not settings:
        default_settings = CompanySettingsModel().model_dump()
        await db.company_settings.insert_one({"id": generate_id(), **default_settings})
        return CompanySettingsModel()
    return CompanySettingsModel(**settings)

@settings_router.put("/company", response_model=CompanySettingsModel)
async def update_company_settings(update: CompanySettingsUpdate, user: dict = Depends(require_roles(["Admin"]))):
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    
    result = await db.company_settings.find_one_and_update(
        {},
        {"$set": update_data},
        upsert=True,
        return_document=True
    )
    
    await create_audit_log(user["id"], "update", "company_settings", "main", update_data)
    
    return CompanySettingsModel(**{k: v for k, v in result.items() if k != "_id"})

# ============ MASTER DATA ROUTES ============

# Units of Measure
@master_router.post("/units", response_model=UnitOfMeasureResponse)
async def create_unit(data: UnitOfMeasureCreate, user: dict = Depends(require_roles(["Admin"]))):
    existing = await db.units_of_measure.find_one({"code": data.code})
    if existing:
        raise HTTPException(status_code=400, detail="Unit code already exists")
    
    unit = {"id": generate_id(), **data.model_dump()}
    await db.units_of_measure.insert_one(unit)
    await create_audit_log(user["id"], "create", "unit_of_measure", unit["id"], data.model_dump())
    return UnitOfMeasureResponse(**unit)

@master_router.get("/units", response_model=List[UnitOfMeasureResponse])
async def list_units(user: dict = Depends(get_current_user)):
    units = await db.units_of_measure.find({}, {"_id": 0}).to_list(1000)
    return [UnitOfMeasureResponse(**u) for u in units]

@master_router.get("/units/{unit_id}", response_model=UnitOfMeasureResponse)
async def get_unit(unit_id: str, user: dict = Depends(get_current_user)):
    u = await db.units_of_measure.find_one({"id": unit_id}, {"_id": 0})
    if not u:
        raise HTTPException(status_code=404, detail="Unit not found")
    return UnitOfMeasureResponse(**u)

@master_router.put("/units/{unit_id}", response_model=UnitOfMeasureResponse)
async def update_unit(unit_id: str, data: UnitOfMeasureCreate, user: dict = Depends(require_roles(["Admin"]))):
    result = await db.units_of_measure.find_one_and_update(
        {"id": unit_id},
        {"$set": data.model_dump()},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Unit not found")
    await create_audit_log(user["id"], "update", "unit_of_measure", unit_id, data.model_dump())
    return UnitOfMeasureResponse(**{k: v for k, v in result.items() if k != "_id"})

# Locations
@master_router.post("/locations", response_model=LocationResponse)
async def create_location(data: LocationCreate, user: dict = Depends(require_roles(["Admin", "Warehouse"]))):
    existing = await db.locations.find_one({"code": data.code})
    if existing:
        raise HTTPException(status_code=400, detail="Location code already exists")
    
    location = {"id": generate_id(), **data.model_dump(), "is_active": True}
    await db.locations.insert_one(location)
    await create_audit_log(user["id"], "create", "location", location["id"], data.model_dump())
    return LocationResponse(**location)

@master_router.get("/locations", response_model=List[LocationResponse])
async def list_locations(user: dict = Depends(get_current_user)):
    locations = await db.locations.find({}, {"_id": 0}).to_list(1000)
    return [LocationResponse(**loc) for loc in locations]

@master_router.get("/locations/{location_id}", response_model=LocationResponse)
async def get_location(location_id: str, user: dict = Depends(get_current_user)):
    loc = await db.locations.find_one({"id": location_id}, {"_id": 0})
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    return LocationResponse(**loc)

@master_router.put("/locations/{location_id}", response_model=LocationResponse)
async def update_location(location_id: str, data: LocationCreate, user: dict = Depends(require_roles(["Admin"]))):
    result = await db.locations.find_one_and_update(
        {"id": location_id},
        {"$set": data.model_dump()},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Location not found")
    await create_audit_log(user["id"], "update", "location", location_id, data.model_dump())
    return LocationResponse(**{k: v for k, v in result.items() if k != "_id"})

# Raw Materials
@master_router.post("/raw-materials", response_model=RawMaterialResponse)
async def create_raw_material(data: RawMaterialCreate, user: dict = Depends(require_roles(["Admin", "Warehouse"]))):
    existing = await db.raw_materials.find_one({"sku": data.sku})
    if existing:
        raise HTTPException(status_code=400, detail="SKU already exists")
    
    material = {"id": generate_id(), **data.model_dump(), "is_active": True}
    await db.raw_materials.insert_one(material)
    await create_audit_log(user["id"], "create", "raw_material", material["id"], data.model_dump())
    return RawMaterialResponse(**material)

def _item_to_raw_material(it: dict) -> dict:
    """Normalize a unified `items` (type=RAW) document into the legacy RawMaterial shape."""
    return {
        "id": it.get("id"),
        "sku": it.get("sku") or "",
        "name": it.get("name") or "",
        "description": it.get("inci_name") or "",
        "unit_of_measure": it.get("unit_of_measure") or "",
        "reorder_point": it.get("min_stock_level") or 0.0,
        "category": it.get("category") or "",
        "is_active": it.get("is_active", True),
    }

@master_router.get("/raw-materials", response_model=List[RawMaterialResponse])
async def list_raw_materials(user: dict = Depends(get_current_user)):
    materials = await db.raw_materials.find({}, {"_id": 0}).to_list(1000)
    imported_items = await db.items.find({"type": "RAW"}, {"_id": 0}).to_list(10000)
    materials.extend(_item_to_raw_material(it) for it in imported_items)
    return [RawMaterialResponse(**m) for m in materials]

@master_router.get("/raw-materials/{material_id}", response_model=RawMaterialResponse)
async def get_raw_material(material_id: str, user: dict = Depends(get_current_user)):
    m = await db.raw_materials.find_one({"id": material_id}, {"_id": 0})
    if not m:
        it = await db.items.find_one({"id": material_id, "type": "RAW"}, {"_id": 0})
        if it:
            m = _item_to_raw_material(it)
    if not m:
        raise HTTPException(status_code=404, detail="Raw material not found")
    return RawMaterialResponse(**m)

@master_router.put("/raw-materials/{material_id}", response_model=RawMaterialResponse)
async def update_raw_material(material_id: str, data: RawMaterialCreate, user: dict = Depends(require_roles(["Admin"]))):
    result = await db.raw_materials.find_one_and_update(
        {"id": material_id},
        {"$set": data.model_dump()},
        return_document=True
    )
    if result:
        await create_audit_log(user["id"], "update", "raw_material", material_id, data.model_dump())
        return RawMaterialResponse(**{k: v for k, v in result.items() if k != "_id"})

    # Most real materials were Excel-imported into the unified `items` collection, not
    # the legacy `raw_materials` collection - fall back to updating there.
    item_update = {
        "sku": data.sku,
        "name": data.name,
        "inci_name": data.description or "",
        "unit_of_measure": data.unit_of_measure,
        "min_stock_level": data.reorder_point,
        "category": data.category or "",
    }
    result = await db.items.find_one_and_update(
        {"id": material_id, "type": "RAW"},
        {"$set": item_update},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Raw material not found")
    await create_audit_log(user["id"], "update", "raw_material", material_id, data.model_dump())
    return RawMaterialResponse(**_item_to_raw_material(result))

# Packaging Materials
@master_router.post("/packaging-materials", response_model=PackagingMaterialResponse)
async def create_packaging_material(data: PackagingMaterialCreate, user: dict = Depends(require_roles(["Admin", "Warehouse"]))):
    existing = await db.packaging_materials.find_one({"sku": data.sku})
    if existing:
        raise HTTPException(status_code=400, detail="SKU already exists")
    
    material = {"id": generate_id(), **data.model_dump(), "is_active": True}
    await db.packaging_materials.insert_one(material)
    await create_audit_log(user["id"], "create", "packaging_material", material["id"], data.model_dump())
    return PackagingMaterialResponse(**material)

def _item_to_packaging_material(it: dict) -> dict:
    """Normalize a unified `items` (type=PACK) document into the legacy PackagingMaterial shape."""
    return {
        "id": it.get("id"),
        "sku": it.get("sku") or "",
        "name": it.get("name") or "",
        "description": it.get("size_specs") or "",
        "unit_of_measure": it.get("unit_of_measure") or "",
        "reorder_point": it.get("min_stock_level") or 0.0,
        "category": it.get("category") or "",
        "is_active": it.get("is_active", True),
    }

async def find_raw_material(id: str = None, sku: str = None) -> Optional[dict]:
    """Look up a raw material by id or sku, checking both the legacy raw_materials
    collection and the unified items collection (where Excel-imported materials live)."""
    query = {}
    if id:
        query["id"] = id
    if sku:
        query["sku"] = sku
    if not query:
        return None
    m = await db.raw_materials.find_one(query, {"_id": 0})
    if m:
        return m
    it = await db.items.find_one({**query, "type": "RAW"}, {"_id": 0})
    return _item_to_raw_material(it) if it else None

async def find_raw_material_by_name(name: str) -> Optional[dict]:
    """Look up a raw material by exact name (case-insensitive), for Excel sheets that
    identify ingredients by display name rather than SKU (the batching sheet template)."""
    if not name:
        return None
    m = await db.raw_materials.find_one({"name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}}, {"_id": 0})
    if m:
        return m
    it = await db.items.find_one({"type": "RAW", "name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}}, {"_id": 0})
    return _item_to_raw_material(it) if it else None

async def consume_raw_material_fifo(
    item_id: str, unit_of_measure: str, qty_needed: float,
    reference_type: str, reference_id: str, notes: str, user_id: str
) -> dict:
    """Issue qty_needed of a raw material against its oldest available lots first (FIFO),
    across whichever locations actually hold stock. Used where the source data (e.g. an
    uploaded Excel sheet) has no lot-selection UI, so the system must pick real lots itself
    instead of recording consumption against a lot that doesn't exist."""
    snapshots = await db.stock_snapshots.find(
        {"item_id": item_id, "item_type": "raw_material", "status": "Available", "quantity_available": {"$gt": 0}},
        {"_id": 0}
    ).to_list(1000)

    # Order lots oldest-first using their earliest receive transaction
    receive_order = {}
    async for t in db.inventory_transactions.find(
        {"item_id": item_id, "item_type": "raw_material", "transaction_type": {"$in": ["receive", "adjust"]}},
        {"_id": 0, "lot_number": 1, "created_at": 1}
    ).sort("created_at", 1):
        receive_order.setdefault(t.get("lot_number", ""), t["created_at"])
    snapshots.sort(key=lambda s: receive_order.get(s.get("lot_number", ""), ""))

    remaining = qty_needed
    consumed_lots = []
    for snap in snapshots:
        if remaining <= 0:
            break
        take = min(remaining, snap["quantity_available"])
        if take <= 0:
            continue
        transaction = {
            "id": generate_id(),
            "item_id": item_id,
            "item_type": "raw_material",
            "lot_number": snap["lot_number"],
            "location_id": snap["location_id"],
            "transaction_type": "issue",
            "quantity": -take,
            "unit_of_measure": unit_of_measure,
            "reference_type": reference_type,
            "reference_id": reference_id,
            "status": "Available",
            "notes": notes,
            "created_at": get_timestamp(),
            "created_by": user_id
        }
        await db.inventory_transactions.insert_one(transaction)
        await update_stock_snapshot(item_id, "raw_material", snap["lot_number"], snap["location_id"])
        consumed_lots.append({"lot_number": snap["lot_number"], "location_id": snap["location_id"], "quantity": take, "transaction_id": transaction["id"]})
        remaining -= take

    return {"consumed_lots": consumed_lots, "quantity_consumed": qty_needed - remaining, "shortfall": max(remaining, 0)}

async def find_packaging_material(id: str = None, sku: str = None) -> Optional[dict]:
    """Look up a packaging material by id or sku, checking both the legacy
    packaging_materials collection and the unified items collection."""
    query = {}
    if id:
        query["id"] = id
    if sku:
        query["sku"] = sku
    if not query:
        return None
    m = await db.packaging_materials.find_one(query, {"_id": 0})
    if m:
        return m
    it = await db.items.find_one({**query, "type": "PACK"}, {"_id": 0})
    return _item_to_packaging_material(it) if it else None

@master_router.get("/packaging-materials", response_model=List[PackagingMaterialResponse])
async def list_packaging_materials(user: dict = Depends(get_current_user)):
    materials = await db.packaging_materials.find({}, {"_id": 0}).to_list(1000)
    imported_items = await db.items.find({"type": "PACK"}, {"_id": 0}).to_list(10000)
    materials.extend(_item_to_packaging_material(it) for it in imported_items)
    return [PackagingMaterialResponse(**m) for m in materials]

@master_router.get("/packaging-materials/{material_id}", response_model=PackagingMaterialResponse)
async def get_packaging_material(material_id: str, user: dict = Depends(get_current_user)):
    m = await db.packaging_materials.find_one({"id": material_id}, {"_id": 0})
    if not m:
        it = await db.items.find_one({"id": material_id, "type": "PACK"}, {"_id": 0})
        if it:
            m = _item_to_packaging_material(it)
    if not m:
        raise HTTPException(status_code=404, detail="Packaging material not found")
    return PackagingMaterialResponse(**m)

@master_router.put("/packaging-materials/{material_id}", response_model=PackagingMaterialResponse)
async def update_packaging_material(material_id: str, data: PackagingMaterialCreate, user: dict = Depends(require_roles(["Admin"]))):
    result = await db.packaging_materials.find_one_and_update(
        {"id": material_id},
        {"$set": data.model_dump()},
        return_document=True
    )
    if result:
        await create_audit_log(user["id"], "update", "packaging_material", material_id, data.model_dump())
        return PackagingMaterialResponse(**{k: v for k, v in result.items() if k != "_id"})

    # Some packaging materials were Excel-imported into the unified `items` collection -
    # fall back to updating there.
    item_update = {
        "sku": data.sku,
        "name": data.name,
        "size_specs": data.description or "",
        "unit_of_measure": data.unit_of_measure,
        "min_stock_level": data.reorder_point,
        "category": data.category or "",
    }
    result = await db.items.find_one_and_update(
        {"id": material_id, "type": "PACK"},
        {"$set": item_update},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Packaging material not found")
    await create_audit_log(user["id"], "update", "packaging_material", material_id, data.model_dump())
    return PackagingMaterialResponse(**_item_to_packaging_material(result))

# Products (Finished Goods)
@master_router.post("/products", response_model=ProductResponse)
async def create_product(data: ProductCreate, user: dict = Depends(require_roles(["Admin"]))):
    existing = await db.products.find_one({"sku": data.sku})
    if existing:
        raise HTTPException(status_code=400, detail="SKU already exists")

    product = {"id": generate_id(), **data.model_dump(), "is_active": True}
    await db.products.insert_one(product)
    await create_audit_log(user["id"], "create", "product", product["id"], data.model_dump())
    return ProductResponse(**product)

@master_router.get("/products", response_model=List[ProductResponse])
async def list_products(user: dict = Depends(get_current_user)):
    products = await db.products.find({}, {"_id": 0}).to_list(1000)
    return [ProductResponse(**p) for p in products]

@master_router.get("/products/{product_id}", response_model=ProductResponse)
async def get_product(product_id: str, user: dict = Depends(get_current_user)):
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return ProductResponse(**p)

@master_router.put("/products/{product_id}", response_model=ProductResponse)
async def update_product(product_id: str, data: ProductCreate, user: dict = Depends(require_roles(["Admin"]))):
    result = await db.products.find_one_and_update(
        {"id": product_id},
        {"$set": data.model_dump()},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Product not found")
    await create_audit_log(user["id"], "update", "product", product_id, data.model_dump())
    return ProductResponse(**{k: v for k, v in result.items() if k != "_id"})

# Recipes / BOM
@master_router.post("/recipes", response_model=RecipeResponse)
async def create_recipe(data: RecipeCreate, user: dict = Depends(require_roles(["Admin", "Production"]))):
    recipe_id = generate_id()
    recipe = {
        "id": recipe_id,
        "product_id": data.product_id,
        "name": data.name,
        "batch_size": data.batch_size,
        "batch_unit": data.batch_unit,
        "ingredients": [i.model_dump() for i in data.ingredients],
        "filling_components": [c.model_dump() for c in data.filling_components],
        "batch_yield_loss_percent": data.batch_yield_loss_percent,
        "filling_yield_loss_percent": data.filling_yield_loss_percent,
        "version": data.version,
        "effective_date": data.effective_date or get_timestamp(),
        "is_active": True
    }
    await db.recipes.insert_one(recipe)
    await create_audit_log(user["id"], "create", "recipe", recipe_id, data.model_dump())
    return RecipeResponse(**recipe)

@master_router.get("/recipes", response_model=List[RecipeResponse])
async def list_recipes(product_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {}
    if product_id:
        query["product_id"] = product_id
    recipes = await db.recipes.find(query, {"_id": 0}).to_list(1000)
    return [RecipeResponse(**r) for r in recipes]

@master_router.get("/recipes/{recipe_id}", response_model=RecipeResponse)
async def get_recipe(recipe_id: str, user: dict = Depends(get_current_user)):
    r = await db.recipes.find_one({"id": recipe_id}, {"_id": 0})
    if not r:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return RecipeResponse(**r)

@master_router.put("/recipes/{recipe_id}", response_model=RecipeResponse)
async def update_recipe(recipe_id: str, data: RecipeCreate, user: dict = Depends(require_roles(["Admin"]))):
    result = await db.recipes.find_one_and_update(
        {"id": recipe_id},
        {"$set": {
            "product_id": data.product_id,
            "name": data.name,
            "batch_size": data.batch_size,
            "batch_unit": data.batch_unit,
            "ingredients": [i.model_dump() for i in data.ingredients],
            "filling_components": [c.model_dump() for c in data.filling_components],
            "batch_yield_loss_percent": data.batch_yield_loss_percent,
            "filling_yield_loss_percent": data.filling_yield_loss_percent,
            "version": data.version,
        }},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Recipe not found")
    await create_audit_log(user["id"], "update", "recipe", recipe_id, data.model_dump())
    return RecipeResponse(**{k: v for k, v in result.items() if k != "_id"})

@master_router.delete("/recipes/{recipe_id}")
async def delete_recipe(recipe_id: str, user: dict = Depends(require_roles(["Admin"]))):
    result = await db.recipes.delete_one({"id": recipe_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Recipe not found")
    await create_audit_log(user["id"], "delete", "recipe", recipe_id, {})
    return {"message": "Recipe deleted"}

# Units of Measure - Expanded UOM support
DEFAULT_UOMS = [
    # Mass
    {"code": "KG", "name": "Kilogram", "category": "mass", "base_unit": "KG", "conversion_factor": 1.0},
    {"code": "G", "name": "Gram", "category": "mass", "base_unit": "KG", "conversion_factor": 0.001},
    {"code": "MG", "name": "Milligram", "category": "mass", "base_unit": "KG", "conversion_factor": 0.000001},
    {"code": "LB", "name": "Pound", "category": "mass", "base_unit": "KG", "conversion_factor": 0.453592},
    {"code": "OZ", "name": "Ounce (weight)", "category": "mass", "base_unit": "KG", "conversion_factor": 0.0283495, "aliases": ["ounce", "oz"]},
    # Volume
    {"code": "L", "name": "Liter", "category": "volume", "base_unit": "L", "conversion_factor": 1.0},
    {"code": "ML", "name": "Milliliter", "category": "volume", "base_unit": "L", "conversion_factor": 0.001},
    {"code": "GAL", "name": "Gallon", "category": "volume", "base_unit": "L", "conversion_factor": 3.78541},
    {"code": "FL_OZ", "name": "Fluid Ounce", "category": "volume", "base_unit": "L", "conversion_factor": 0.0295735, "aliases": ["fl oz", "fl. oz", "fluid ounce"]},
    # Count
    {"code": "EA", "name": "Each", "category": "count", "base_unit": "EA", "conversion_factor": 1.0, "aliases": ["each", "unit", "units", "pcs", "pc"]},
    {"code": "PCS", "name": "Pieces", "category": "count", "base_unit": "EA", "conversion_factor": 1.0},
    {"code": "CASE", "name": "Case", "category": "count", "base_unit": "EA", "conversion_factor": 1.0},
    {"code": "BOX", "name": "Box", "category": "count", "base_unit": "EA", "conversion_factor": 1.0},
]

@master_router.get("/uom")
async def list_units_of_measure(user: dict = Depends(get_current_user)):
    """List all units of measure including custom ones"""
    # Get custom UOMs from DB
    custom_uoms = await db.units_of_measure.find({}, {"_id": 0}).to_list(100)
    
    # Combine with defaults
    all_uoms = DEFAULT_UOMS.copy()
    for custom in custom_uoms:
        if not any(u["code"] == custom["code"] for u in all_uoms):
            all_uoms.append(custom)
    
    return {"uoms": all_uoms}

@master_router.post("/uom")
async def create_unit_of_measure(
    code: str,
    name: str,
    category: str = "custom",
    base_unit: str = "EA",
    conversion_factor: float = 1.0,
    aliases: Optional[List[str]] = None,
    user: dict = Depends(require_roles(["Admin"]))
):
    """Create a custom unit of measure (ADMIN ONLY)"""
    existing = await db.units_of_measure.find_one({"code": code.upper()})
    if existing:
        raise HTTPException(status_code=400, detail="UOM code already exists")
    
    uom = {
        "id": generate_id(),
        "code": code.upper(),
        "name": name,
        "category": category,
        "base_unit": base_unit.upper(),
        "conversion_factor": conversion_factor,
        "aliases": aliases or [],
        "created_at": get_timestamp()
    }
    await db.units_of_measure.insert_one(uom)
    uom.pop("_id", None)
    return uom

@master_router.get("/uom/resolve/{uom_text}")
async def resolve_uom(uom_text: str, user: dict = Depends(get_current_user)):
    """Resolve a UOM text (including aliases) to standard code"""
    text = uom_text.strip().upper()
    
    # Check default UOMs
    for uom in DEFAULT_UOMS:
        if uom["code"] == text:
            return {"resolved": uom["code"], "uom": uom}
        if "aliases" in uom and text.lower() in [a.lower() for a in uom.get("aliases", [])]:
            return {"resolved": uom["code"], "uom": uom}
    
    # Check custom UOMs
    custom = await db.units_of_measure.find_one(
        {"$or": [{"code": text}, {"aliases": {"$in": [uom_text.lower()]}}]},
        {"_id": 0}
    )
    if custom:
        return {"resolved": custom["code"], "uom": custom}
    
    # Not found - return as-is
    return {"resolved": text, "uom": None, "warning": "UOM not recognized"}

# Categories management
@master_router.get("/categories")
async def list_categories(type: Optional[str] = None, user: dict = Depends(get_current_user)):
    """List all categories"""
    query = {}
    if type:
        query["type"] = type.upper()
    
    categories = await db.categories.find(query, {"_id": 0}).to_list(500)
    
    # Also get distinct from items
    item_cats = await db.items.distinct("category")
    item_subcats = await db.items.distinct("sub_category")
    
    all_cats = list(set([c["name"] for c in categories] + [c for c in item_cats if c] + [c for c in item_subcats if c]))
    all_cats.sort()
    
    return {"categories": categories, "all_category_names": all_cats}

@master_router.post("/categories")
async def create_category(
    name: str,
    type: str = "ALL",
    parent_id: Optional[str] = None,
    description: Optional[str] = None,
    user: dict = Depends(require_roles(["Admin"]))
):
    """Create a new category (ADMIN ONLY)"""
    existing = await db.categories.find_one({"name": name, "type": type.upper()})
    if existing:
        raise HTTPException(status_code=400, detail="Category already exists")
    
    category = {
        "id": generate_id(),
        "name": name,
        "type": type.upper(),
        "parent_id": parent_id,
        "description": description or "",
        "created_at": get_timestamp()
    }
    await db.categories.insert_one(category)
    category.pop("_id", None)
    return category

# ============ INVENTORY ROUTES ============

@inventory_router.post("/transactions", response_model=InventoryTransactionResponse)
async def create_inventory_transaction(
    data: InventoryTransactionCreate,
    user: dict = Depends(require_roles(["Admin", "Warehouse", "Production"]))
):
    # Validate no negative inventory (unless scrap or admin)
    if data.transaction_type in ["issue", "scrap"] and user["role"] != "Admin":
        snapshot = await db.stock_snapshots.find_one({
            "item_id": data.item_id,
            "item_type": data.item_type,
            "lot_number": data.lot_number,
            "location_id": data.location_id
        }, {"_id": 0})
        
        available = snapshot.get("quantity_available", 0) if snapshot else 0
        if abs(data.quantity) > available:
            raise HTTPException(status_code=400, detail=f"Insufficient inventory. Available: {available}")
    
    transaction = {
        "id": generate_id(),
        "item_id": data.item_id,
        "item_type": data.item_type,
        "lot_number": data.lot_number,
        "location_id": data.location_id,
        "transaction_type": data.transaction_type,
        "quantity": data.quantity if data.transaction_type in ["receive", "produce", "adjust"] else -abs(data.quantity),
        "unit_of_measure": data.unit_of_measure,
        "reference_type": data.reference_type,
        "reference_id": data.reference_id,
        "status": data.status,
        "notes": data.notes or "",
        "created_at": get_timestamp(),
        "created_by": user["id"]
    }
    
    await db.inventory_transactions.insert_one(transaction)
    
    # Update stock snapshot
    await update_stock_snapshot(data.item_id, data.item_type, data.lot_number, data.location_id)
    
    # Broadcast update
    await broadcast_update("inventory.updated", {"item_id": data.item_id, "lot_number": data.lot_number})
    
    await create_audit_log(user["id"], "create", "inventory_transaction", transaction["id"], data.model_dump())
    
    return InventoryTransactionResponse(**transaction)

@inventory_router.get("/transactions", response_model=List[InventoryTransactionResponse])
async def list_inventory_transactions(
    item_id: Optional[str] = None,
    item_type: Optional[str] = None,
    lot_number: Optional[str] = None,
    location_id: Optional[str] = None,
    limit: int = Query(500, le=10000),
    user: dict = Depends(get_current_user)
):
    query = {}
    if item_id:
        query["item_id"] = item_id
    if item_type:
        query["item_type"] = item_type
    if lot_number:
        query["lot_number"] = lot_number
    if location_id:
        query["location_id"] = location_id

    transactions = await db.inventory_transactions.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return [InventoryTransactionResponse(**t) for t in transactions]

class InventoryTransactionEdit(BaseModel):
    quantity: float  # the human-facing magnitude - sign is reapplied based on the transaction's own type
    notes: Optional[str] = ""

@inventory_router.put("/transactions/{transaction_id}", response_model=InventoryTransactionResponse)
async def update_inventory_transaction(transaction_id: str, data: InventoryTransactionEdit, user: dict = Depends(require_roles(["Admin"]))):
    """Correct a mistaken ledger entry (e.g. a test receiving with a typo'd quantity).
    Recomputes the affected stock snapshot afterward so real stock stays accurate."""
    existing = await db.inventory_transactions.find_one({"id": transaction_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Transaction not found")

    signed_quantity = data.quantity if existing["transaction_type"] in ["receive", "produce", "adjust"] else -abs(data.quantity)

    result = await db.inventory_transactions.find_one_and_update(
        {"id": transaction_id},
        {"$set": {"quantity": signed_quantity, "notes": data.notes or ""}},
        return_document=True
    )
    await update_stock_snapshot(existing["item_id"], existing["item_type"], existing["lot_number"], existing["location_id"])
    await create_audit_log(user["id"], "update", "inventory_transaction", transaction_id, {"quantity": signed_quantity, "notes": data.notes})
    return InventoryTransactionResponse(**{k: v for k, v in result.items() if k != "_id"})

@inventory_router.delete("/transactions/{transaction_id}")
async def delete_inventory_transaction(transaction_id: str, user: dict = Depends(require_roles(["Admin"]))):
    """Remove a mistaken ledger entry entirely (e.g. a test receive with no real reference)
    and recompute the affected stock snapshot from what's left."""
    existing = await db.inventory_transactions.find_one({"id": transaction_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Transaction not found")

    await db.inventory_transactions.delete_one({"id": transaction_id})
    await update_stock_snapshot(existing["item_id"], existing["item_type"], existing["lot_number"], existing["location_id"])
    await create_audit_log(user["id"], "delete", "inventory_transaction", transaction_id, {"lot_number": existing["lot_number"], "quantity": existing["quantity"]})
    return {"message": "Transaction deleted"}

@inventory_router.get("/stock", response_model=List[StockSnapshotResponse])
async def get_stock(
    item_type: Optional[str] = None,
    item_id: Optional[str] = None,
    location_id: Optional[str] = None,
    status: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    query = {}
    if item_type:
        query["item_type"] = item_type
    if item_id:
        query["item_id"] = item_id
    if location_id:
        query["location_id"] = location_id
    if status:
        query["status"] = status

    snapshots = await db.stock_snapshots.find(query, {"_id": 0}).to_list(10000)
    return [StockSnapshotResponse(**s) for s in snapshots]

@inventory_router.get("/stock/summary")
async def get_stock_summary(user: dict = Depends(get_current_user)):
    """Get aggregated stock summary by item type"""
    pipeline = [
        {"$group": {
            "_id": "$item_type",
            "total_on_hand": {"$sum": "$quantity_on_hand"},
            "total_available": {"$sum": "$quantity_available"},
            "total_reserved": {"$sum": "$quantity_reserved"},
            "lot_count": {"$sum": 1}
        }}
    ]
    results = await db.stock_snapshots.aggregate(pipeline).to_list(100)
    return {r["_id"]: {k: v for k, v in r.items() if k != "_id"} for r in results}

@inventory_router.get("/onhand")
async def get_inventory_onhand(
    item_type: Optional[str] = None,
    category: Optional[str] = None,
    location_id: Optional[str] = None,
    search: Optional[str] = None,
    below_min_only: bool = False,
    skip: int = 0,
    limit: int = 100,
    user: dict = Depends(get_current_user)
):
    """
    Get inventory on-hand with item details, min stock alerts, and filtering
    Computes on-hand from ledger/snapshots
    """
    # Build item query
    item_query = {}
    if item_type:
        item_query["type"] = item_type
    if category:
        item_query["$or"] = [{"category": category}, {"sub_category": category}]
    if search:
        item_query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"sku": {"$regex": search, "$options": "i"}}
        ]
    
    # Get items with their on-hand quantities
    pipeline = [
        {"$match": item_query} if item_query else {"$match": {}},
        {"$lookup": {
            "from": "stock_snapshots",
            "let": {"item_id": "$id"},
            "pipeline": [
                {"$match": {"$expr": {"$eq": ["$item_id", "$$item_id"]}}},
                {"$group": {
                    "_id": "$item_id",
                    "total_on_hand": {"$sum": "$quantity_on_hand"},
                    "total_available": {"$sum": "$quantity_available"},
                    "total_reserved": {"$sum": "$quantity_reserved"},
                    "lot_count": {"$sum": 1},
                    "locations": {"$addToSet": "$location_id"}
                }}
            ],
            "as": "inventory"
        }},
        {"$unwind": {"path": "$inventory", "preserveNullAndEmptyArrays": True}},
        {"$addFields": {
            "on_hand_qty": {"$ifNull": ["$inventory.total_on_hand", 0]},
            "available_qty": {"$ifNull": ["$inventory.total_available", 0]},
            "reserved_qty": {"$ifNull": ["$inventory.total_reserved", 0]},
            "lot_count": {"$ifNull": ["$inventory.lot_count", 0]},
            "locations": {"$ifNull": ["$inventory.locations", []]},
            "stock_status": {
                "$cond": {
                    "if": {"$lte": [{"$ifNull": ["$inventory.total_on_hand", 0]}, 0]},
                    "then": "OUT_OF_STOCK",
                    "else": {
                        "$cond": {
                            "if": {"$and": [
                                {"$gt": [{"$ifNull": ["$min_stock_level", 0]}, 0]},
                                {"$lt": [{"$ifNull": ["$inventory.total_on_hand", 0]}, {"$ifNull": ["$min_stock_level", 0]}]}
                            ]},
                            "then": "LOW_STOCK",
                            "else": "IN_STOCK"
                        }
                    }
                }
            }
        }},
        {"$project": {"_id": 0, "inventory": 0}}
    ]
    
    # Add min stock filter if requested
    if below_min_only:
        pipeline.append({"$match": {"stock_status": {"$in": ["LOW_STOCK", "OUT_OF_STOCK"]}}})
    
    # Add location filter after lookup
    if location_id:
        pipeline.append({"$match": {"locations": location_id}})
    
    # Add pagination
    pipeline.extend([
        {"$sort": {"name": 1}},
        {"$skip": skip},
        {"$limit": limit}
    ])
    
    items = await db.items.aggregate(pipeline).to_list(limit)
    
    # Get total count
    count_pipeline = [p for p in pipeline if "$skip" not in p and "$limit" not in p]
    count_pipeline.append({"$count": "total"})
    count_result = await db.items.aggregate(count_pipeline).to_list(1)
    total = count_result[0]["total"] if count_result else 0
    
    return {"items": items, "total": total, "skip": skip, "limit": limit}

@inventory_router.get("/onhand/{item_id}")
async def get_item_onhand_detail(item_id: str, user: dict = Depends(get_current_user)):
    """Get detailed on-hand for a specific item including lot breakdown"""
    item = await db.items.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Get lot-level breakdown
    lots = await db.stock_snapshots.find({"item_id": item_id}, {"_id": 0}).to_list(1000)
    
    # Get recent transactions
    transactions = await db.inventory_transactions.find(
        {"item_id": item_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)
    
    # Calculate totals
    total_on_hand = sum(l.get("quantity_on_hand", 0) for l in lots)
    total_available = sum(l.get("quantity_available", 0) for l in lots)
    total_reserved = sum(l.get("quantity_reserved", 0) for l in lots)
    
    return {
        "item": item,
        "totals": {
            "on_hand": total_on_hand,
            "available": total_available,
            "reserved": total_reserved
        },
        "lots": lots,
        "recent_transactions": transactions
    }

@inventory_router.get("/alerts/low-stock")
async def get_low_stock_alerts(user: dict = Depends(get_current_user)):
    """Get all items below minimum stock level"""
    pipeline = [
        {"$lookup": {
            "from": "stock_snapshots",
            "let": {"item_id": "$id"},
            "pipeline": [
                {"$match": {"$expr": {"$eq": ["$item_id", "$$item_id"]}}},
                {"$group": {"_id": "$item_id", "total_on_hand": {"$sum": "$quantity_on_hand"}}}
            ],
            "as": "inventory"
        }},
        {"$unwind": {"path": "$inventory", "preserveNullAndEmptyArrays": True}},
        {"$addFields": {
            "on_hand_qty": {"$ifNull": ["$inventory.total_on_hand", 0]}
        }},
        {"$match": {
            "$expr": {
                "$and": [
                    {"$gt": ["$min_stock_level", 0]},
                    {"$lt": ["$on_hand_qty", "$min_stock_level"]}
                ]
            }
        }},
        {"$project": {
            "_id": 0,
            "id": 1, "sku": 1, "name": 1, "type": 1, "category": 1,
            "min_stock_level": 1, "on_hand_qty": 1, "unit_of_measure": 1,
            "shortage": {"$subtract": ["$min_stock_level", "$on_hand_qty"]}
        }},
        {"$sort": {"shortage": -1}}
    ]
    
    alerts = await db.items.aggregate(pipeline).to_list(500)
    return {"alerts": alerts, "count": len(alerts)}

# ============ SEARCH ENDPOINTS (for searchable dropdowns) ============

search_router = APIRouter(prefix="/search", tags=["Search"])

@search_router.get("/items")
async def search_items(
    q: str = "",
    type: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = Query(50, le=200),
    user: dict = Depends(get_current_user)
):
    """
    Search items by name/SKU for searchable dropdowns
    Supports type filter: RAW, PACK, FG
    """
    query = {}
    
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"sku": {"$regex": q, "$options": "i"}}
        ]
    
    if type:
        query["type"] = type.upper()
    
    if category:
        query["category"] = category
    
    items = await db.items.find(
        query,
        {"_id": 0, "id": 1, "sku": 1, "name": 1, "type": 1, "category": 1, "unit_of_measure": 1}
    ).limit(limit).to_list(limit)
    
    return {"items": items, "count": len(items)}

@search_router.get("/lots")
async def search_lots(
    q: str = "",
    item_id: Optional[str] = None,
    location_id: Optional[str] = None,
    available_only: bool = True,
    limit: int = Query(50, le=200),
    user: dict = Depends(get_current_user)
):
    """Search lots for searchable dropdowns"""
    query = {}
    
    if q:
        query["lot_number"] = {"$regex": q, "$options": "i"}
    
    if item_id:
        query["item_id"] = item_id
    
    if location_id:
        query["location_id"] = location_id
    
    if available_only:
        query["quantity_available"] = {"$gt": 0}
    
    lots = await db.stock_snapshots.find(
        query,
        {"_id": 0, "lot_number": 1, "item_id": 1, "location_id": 1, "quantity_on_hand": 1, "quantity_available": 1, "status": 1}
    ).limit(limit).to_list(limit)
    
    return {"lots": lots, "count": len(lots)}

@search_router.get("/categories")
async def search_categories(
    q: str = "",
    type: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    """Get distinct categories from items"""
    query = {}
    if type:
        query["type"] = type.upper()
    
    categories = await db.items.distinct("category", query)
    sub_categories = await db.items.distinct("sub_category", query)
    
    all_cats = list(set([c for c in categories + sub_categories if c and (not q or q.lower() in c.lower())]))
    all_cats.sort()
    
    return {"categories": all_cats}

@search_router.get("/locations")
async def search_locations(
    q: str = "",
    limit: int = Query(50, le=200),
    user: dict = Depends(get_current_user)
):
    """Search locations for dropdowns"""
    query = {}
    if q:
        query["$or"] = [
            {"code": {"$regex": q, "$options": "i"}},
            {"name": {"$regex": q, "$options": "i"}}
        ]
    
    locations = await db.locations.find(
        query,
        {"_id": 0, "id": 1, "code": 1, "name": 1, "type": 1}
    ).limit(limit).to_list(limit)
    
    return {"locations": locations, "count": len(locations)}

@search_router.get("/formulas")
async def search_formulas(
    q: str = "",
    category: Optional[str] = None,
    limit: int = Query(50, le=200),
    user: dict = Depends(get_current_user)
):
    """Search formulas/recipes for dropdowns"""
    query = {"status": "Active"}
    
    if q:
        query["name"] = {"$regex": q, "$options": "i"}
    
    if category:
        query["category"] = category
    
    formulas = await db.formulas.find(
        query,
        {"_id": 0, "id": 1, "name": 1, "category": 1, "recipe_required": 1, "batch_unit": 1}
    ).limit(limit).to_list(limit)
    
    return {"formulas": formulas, "count": len(formulas)}

@inventory_router.post("/receive")
async def receive_inventory(
    item_id: str,
    item_type: str,
    quantity: float,
    unit_of_measure: str,
    location_id: str,
    lot_number: Optional[str] = None,
    user: dict = Depends(require_roles(["Admin", "Warehouse"]))
):
    """Receive inventory - creates new lot if not provided"""
    if not lot_number:
        prefix = "RM" if item_type == "raw_material" else "PKG" if item_type == "packaging_material" else "LOT"
        lot_number = await generate_lot_number(prefix)
    
    transaction = InventoryTransactionCreate(
        item_id=item_id,
        item_type=item_type,
        lot_number=lot_number,
        location_id=location_id,
        transaction_type="receive",
        quantity=quantity,
        unit_of_measure=unit_of_measure,
        status="Available"
    )
    
    result = await create_inventory_transaction(transaction, user)
    return {"lot_number": lot_number, "transaction": result}

@inventory_router.post("/transfer")
async def transfer_inventory(
    data: InventoryTransferRequest,
    user: dict = Depends(require_roles(["Admin", "Warehouse"]))
):
    """Move quantity of a lot from one location to another, keeping the same lot number."""
    if data.from_location_id == data.to_location_id:
        raise HTTPException(status_code=400, detail="Source and destination locations must be different")
    if data.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than zero")

    source = await db.stock_snapshots.find_one({
        "item_id": data.item_id,
        "item_type": data.item_type,
        "lot_number": data.lot_number,
        "location_id": data.from_location_id
    }, {"_id": 0})
    available = source.get("quantity_available", 0) if source else 0
    if data.quantity > available:
        raise HTTPException(status_code=400, detail=f"Insufficient inventory at source. Available: {available}")

    unit_of_measure = source.get("unit_of_measure", "EA")
    notes = data.notes or f"Transfer to {data.to_location_id}"

    for location_id, quantity in [(data.from_location_id, -data.quantity), (data.to_location_id, data.quantity)]:
        transaction = {
            "id": generate_id(),
            "item_id": data.item_id,
            "item_type": data.item_type,
            "lot_number": data.lot_number,
            "location_id": location_id,
            "transaction_type": "transfer",
            "quantity": quantity,
            "unit_of_measure": unit_of_measure,
            "reference_type": "transfer",
            "reference_id": None,
            "status": "Available",
            "notes": notes,
            "created_at": get_timestamp(),
            "created_by": user["id"]
        }
        await db.inventory_transactions.insert_one(transaction)
        await update_stock_snapshot(data.item_id, data.item_type, data.lot_number, location_id)

    await broadcast_update("inventory.updated", {"item_id": data.item_id, "lot_number": data.lot_number})
    await create_audit_log(user["id"], "transfer", "inventory", data.item_id, data.model_dump())

    return {"message": "Transfer complete", "lot_number": data.lot_number, "quantity": data.quantity}

# ============ MANUFACTURING ROUTES ============

# Batch Orders
@manufacturing_router.post("/batch-orders", response_model=BatchOrderResponse)
async def create_batch_order(
    data: BatchOrderCreate,
    user: dict = Depends(require_roles(["Admin", "Production"]))
):
    recipe = await db.recipes.find_one({"id": data.recipe_id}, {"_id": 0})
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    batch_number = await generate_lot_number("BATCH")
    
    batch_order = {
        "id": generate_id(),
        "batch_number": batch_number,
        "recipe_id": data.recipe_id,
        "product_id": recipe["product_id"],
        "planned_quantity": data.planned_quantity,
        "actual_quantity": None,
        "target_location_id": data.target_location_id,
        "status": "Planned",
        "notes": data.notes or "",
        "created_at": get_timestamp(),
        "created_by": user["id"],
        "completed_at": None
    }
    
    await db.batch_orders.insert_one(batch_order)
    await broadcast_update("batch.updated", {"batch_number": batch_number, "status": "Planned"})
    await create_audit_log(user["id"], "create", "batch_order", batch_order["id"], data.model_dump())
    
    return BatchOrderResponse(**batch_order)

@manufacturing_router.get("/batch-orders", response_model=List[BatchOrderResponse])
async def list_batch_orders(status: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {}
    if status:
        query["status"] = status
    orders = await db.batch_orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [BatchOrderResponse(**o) for o in orders]

@manufacturing_router.get("/batch-orders/{batch_id}", response_model=BatchOrderResponse)
async def get_batch_order(batch_id: str, user: dict = Depends(get_current_user)):
    order = await db.batch_orders.find_one({"id": batch_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Batch order not found")
    return BatchOrderResponse(**order)

@manufacturing_router.post("/batch-orders/{batch_id}/start")
async def start_batch_order(batch_id: str, user: dict = Depends(require_roles(["Admin", "Production"]))):
    order = await db.batch_orders.find_one({"id": batch_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Batch order not found")
    
    if order["status"] != "Planned":
        raise HTTPException(status_code=400, detail="Batch order must be in Planned status")
    
    await db.batch_orders.update_one({"id": batch_id}, {"$set": {"status": "In Progress"}})
    await broadcast_update("batch.updated", {"batch_number": order["batch_number"], "status": "In Progress"})
    
    return {"message": "Batch order started", "status": "In Progress"}

@manufacturing_router.post("/batch-orders/{batch_id}/consume")
async def consume_materials_for_batch(
    batch_id: str,
    consumptions: List[BatchConsumptionCreate],
    user: dict = Depends(require_roles(["Admin", "Production"]))
):
    """Consume raw materials for batch order using FIFO"""
    order = await db.batch_orders.find_one({"id": batch_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Batch order not found")
    
    if order["status"] != "In Progress":
        raise HTTPException(status_code=400, detail="Batch order must be In Progress")
    
    consumed = []
    for c in consumptions:
        # Get material info
        material = await find_raw_material(id=c.material_id)
        if not material:
            raise HTTPException(status_code=404, detail=f"Material {c.material_id} not found")
        
        # Create consumption transaction
        transaction = InventoryTransactionCreate(
            item_id=c.material_id,
            item_type="raw_material",
            lot_number=c.lot_number,
            location_id=order["target_location_id"],
            transaction_type="issue",
            quantity=c.quantity,
            unit_of_measure=material["unit_of_measure"],
            reference_type="batch_order",
            reference_id=batch_id,
            status="Available"
        )
        
        result = await create_inventory_transaction(transaction, user)
        
        # Record consumption
        consumption_record = {
            "id": generate_id(),
            "batch_order_id": batch_id,
            "material_id": c.material_id,
            "lot_number": c.lot_number,
            "quantity": c.quantity,
            "created_at": get_timestamp()
        }
        await db.batch_consumptions.insert_one(consumption_record)
        consumed.append(consumption_record)
    
    return {"message": "Materials consumed", "consumptions": consumed}

@manufacturing_router.post("/batch-orders/{batch_id}/complete")
async def complete_batch_order(
    batch_id: str,
    actual_quantity: float,
    user: dict = Depends(require_roles(["Admin", "Production"]))
):
    """Complete batch order and produce WIP"""
    order = await db.batch_orders.find_one({"id": batch_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Batch order not found")
    
    if order["status"] != "In Progress":
        raise HTTPException(status_code=400, detail="Batch order must be In Progress")
    
    recipe = await db.recipes.find_one({"id": order["recipe_id"]}, {"_id": 0})
    
    # Create WIP lot
    wip_lot_number = await generate_lot_number("WIP")
    
    # Create inventory transaction for WIP production
    transaction = InventoryTransactionCreate(
        item_id=order["product_id"],
        item_type="wip_batch",
        lot_number=wip_lot_number,
        location_id=order["target_location_id"],
        transaction_type="produce",
        quantity=actual_quantity,
        unit_of_measure=recipe["batch_unit"],
        reference_type="batch_order",
        reference_id=batch_id,
        status="Available"
    )
    
    await create_inventory_transaction(transaction, user)
    
    # Update batch order
    await db.batch_orders.update_one(
        {"id": batch_id},
        {"$set": {
            "status": "Completed",
            "actual_quantity": actual_quantity,
            "wip_lot_number": wip_lot_number,
            "completed_at": get_timestamp()
        }}
    )
    
    await broadcast_update("batch.updated", {
        "batch_number": order["batch_number"],
        "status": "Completed",
        "wip_lot_number": wip_lot_number
    })
    
    variance = actual_quantity - order["planned_quantity"]
    variance_percent = (variance / order["planned_quantity"]) * 100 if order["planned_quantity"] > 0 else 0
    
    return {
        "message": "Batch completed",
        "wip_lot_number": wip_lot_number,
        "actual_quantity": actual_quantity,
        "planned_quantity": order["planned_quantity"],
        "variance": variance,
        "variance_percent": round(variance_percent, 2)
    }

@manufacturing_router.post("/batch-orders/{batch_id}/qa-hold")
async def qa_hold_batch(batch_id: str, user: dict = Depends(require_roles(["Admin", "QA"]))):
    order = await db.batch_orders.find_one({"id": batch_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Batch order not found")
    
    await db.batch_orders.update_one({"id": batch_id}, {"$set": {"status": "QA Hold"}})
    
    # Update WIP inventory status to Quarantine
    if order.get("wip_lot_number"):
        await db.stock_snapshots.update_many(
            {"lot_number": order["wip_lot_number"]},
            {"$set": {"status": "Quarantine"}}
        )
    
    await broadcast_update("batch.updated", {"batch_number": order["batch_number"], "status": "QA Hold"})
    return {"message": "Batch placed on QA hold", "status": "QA Hold"}

@manufacturing_router.post("/batch-orders/{batch_id}/release")
async def release_batch(batch_id: str, user: dict = Depends(require_roles(["Admin", "QA"]))):
    order = await db.batch_orders.find_one({"id": batch_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Batch order not found")
    
    await db.batch_orders.update_one({"id": batch_id}, {"$set": {"status": "Released"}})
    
    # Update WIP inventory status to Available
    if order.get("wip_lot_number"):
        await db.stock_snapshots.update_many(
            {"lot_number": order["wip_lot_number"]},
            {"$set": {"status": "Available"}}
        )
    
    await broadcast_update("batch.updated", {"batch_number": order["batch_number"], "status": "Released"})
    return {"message": "Batch released", "status": "Released"}

# Filling Orders
@manufacturing_router.post("/filling-orders", response_model=FillingOrderResponse)
async def create_filling_order(
    data: FillingOrderCreate,
    user: dict = Depends(require_roles(["Admin", "Production"]))
):
    recipe = await db.recipes.find_one({"id": data.recipe_id}, {"_id": 0})
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    filling_number = await generate_lot_number("FILL")
    
    filling_order = {
        "id": generate_id(),
        "filling_number": filling_number,
        "product_id": data.product_id,
        "recipe_id": data.recipe_id,
        "planned_quantity": data.planned_quantity,
        "actual_quantity": None,
        "target_location_id": data.target_location_id,
        "status": "Planned",
        "notes": data.notes or "",
        "created_at": get_timestamp(),
        "created_by": user["id"],
        "completed_at": None
    }
    
    await db.filling_orders.insert_one(filling_order)
    await broadcast_update("filling.updated", {"filling_number": filling_number, "status": "Planned"})
    await create_audit_log(user["id"], "create", "filling_order", filling_order["id"], data.model_dump())
    
    return FillingOrderResponse(**filling_order)

@manufacturing_router.get("/filling-orders", response_model=List[FillingOrderResponse])
async def list_filling_orders(status: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {}
    if status:
        query["status"] = status
    orders = await db.filling_orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [FillingOrderResponse(**o) for o in orders]

@manufacturing_router.get("/filling-orders/{filling_id}", response_model=FillingOrderResponse)
async def get_filling_order(filling_id: str, user: dict = Depends(get_current_user)):
    order = await db.filling_orders.find_one({"id": filling_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Filling order not found")
    return FillingOrderResponse(**order)

@manufacturing_router.post("/filling-orders/{filling_id}/start")
async def start_filling_order(filling_id: str, user: dict = Depends(require_roles(["Admin", "Production"]))):
    order = await db.filling_orders.find_one({"id": filling_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Filling order not found")
    
    if order["status"] != "Planned":
        raise HTTPException(status_code=400, detail="Filling order must be in Planned status")
    
    await db.filling_orders.update_one({"id": filling_id}, {"$set": {"status": "In Progress"}})
    await broadcast_update("filling.updated", {"filling_number": order["filling_number"], "status": "In Progress"})
    
    return {"message": "Filling order started", "status": "In Progress"}

@manufacturing_router.get("/filling-orders/{filling_id}/consumption-plan")
async def get_filling_consumption_plan(filling_id: str, user: dict = Depends(get_current_user)):
    """Suggest WIP and packaging quantities to consume for a filling order, based on the
    order's Recipe/BOM and the linked Formula's fill weight - plus real current stock for
    each, so Filling can be recorded against actual inventory instead of guessed numbers."""
    order = await db.filling_orders.find_one({"id": filling_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Filling order not found")

    recipe = await db.recipes.find_one({"id": order["recipe_id"]}, {"_id": 0})
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found for this filling order")

    planned_qty = order["planned_quantity"]

    # WIP side: parse fill size (e.g. "2oz") from the product to estimate KG of WIP needed
    product = await db.products.find_one({"id": order["product_id"]}, {"_id": 0})
    size_match = re.search(r'(\d+(?:\.\d+)?)\s*oz', f"{product.get('name', '') if product else ''} {product.get('sku', '') if product else ''}", re.IGNORECASE)
    fill_weight_kg = float(size_match.group(1)) * OZ_TO_KG if size_match else None

    wip_lots = await db.stock_snapshots.find({
        "item_type": "wip_batch",
        "item_id": order["product_id"],
        "status": "Available"
    }, {"_id": 0}).to_list(1000)

    wip = {
        "lots": [{"lot_number": l["lot_number"], "quantity_available": l.get("quantity_available", 0), "unit_of_measure": l.get("unit_of_measure", "KG")} for l in wip_lots],
        "suggested_quantity": round(planned_qty * fill_weight_kg, 3) if fill_weight_kg else None,
        "fill_weight_kg_per_unit": fill_weight_kg,
    }

    # Packaging side: each BOM line's real current stock, plus a suggested quantity for this order
    packaging = []
    for fc in recipe.get("filling_components", []):
        material = await find_packaging_material(id=fc.get("material_id"))
        if not material:
            continue
        pkg_stock = await db.stock_snapshots.find({
            "item_type": "packaging_material",
            "item_id": fc["material_id"],
            "status": "Available"
        }, {"_id": 0}).to_list(1000)
        available = sum(s.get("quantity_available", 0) for s in pkg_stock)
        qty_per_unit = fc.get("quantity") or 0
        packaging.append({
            "material_id": fc["material_id"],
            "name": material.get("name", "Unknown"),
            "sku": material.get("sku", ""),
            "uom": material.get("unit_of_measure", "EA"),
            "quantity_per_unit": qty_per_unit,
            "suggested_quantity": round(planned_qty * qty_per_unit, 3),
            "available": round(available, 3),
            "lots": [{"lot_number": s["lot_number"], "quantity_available": s.get("quantity_available", 0)} for s in pkg_stock if s.get("quantity_available", 0) > 0],
        })

    return {"wip": wip, "packaging": packaging}

@manufacturing_router.post("/filling-orders/{filling_id}/consume-wip")
async def consume_wip_for_filling(
    filling_id: str,
    wip_lot_number: str,
    quantity: float,
    user: dict = Depends(require_roles(["Admin", "Production"]))
):
    """Consume WIP batch for filling order"""
    order = await db.filling_orders.find_one({"id": filling_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Filling order not found")
    
    if order["status"] != "In Progress":
        raise HTTPException(status_code=400, detail="Filling order must be In Progress")
    
    # Issue against the lot's real location, not the order's target location (that's
    # where the finished goods end up, not where the WIP currently sits) - otherwise the
    # transaction lands on a snapshot that doesn't exist and silently vanishes.
    wip_snapshot = await db.stock_snapshots.find_one({
        "item_id": order["product_id"],
        "item_type": "wip_batch",
        "lot_number": wip_lot_number,
        "status": "Available"
    }, {"_id": 0})
    if not wip_snapshot:
        raise HTTPException(status_code=404, detail=f"WIP lot {wip_lot_number} not found or not available")

    # Create consumption transaction for WIP
    transaction = InventoryTransactionCreate(
        item_id=order["product_id"],
        item_type="wip_batch",
        lot_number=wip_lot_number,
        location_id=wip_snapshot["location_id"],
        transaction_type="issue",
        quantity=quantity,
        unit_of_measure=wip_snapshot["unit_of_measure"],
        reference_type="filling_order",
        reference_id=filling_id,
        status="Available"
    )

    await create_inventory_transaction(transaction, user)
    
    # Record consumption
    consumption_record = {
        "id": generate_id(),
        "filling_order_id": filling_id,
        "material_type": "wip_batch",
        "lot_number": wip_lot_number,
        "quantity": quantity,
        "created_at": get_timestamp()
    }
    await db.filling_consumptions.insert_one(consumption_record)
    consumption_record.pop("_id", None)

    return {"message": "WIP consumed", "consumption": consumption_record}

@manufacturing_router.post("/filling-orders/{filling_id}/consume-packaging")
async def consume_packaging_for_filling(
    filling_id: str,
    material_id: str,
    lot_number: str,
    quantity: float,
    user: dict = Depends(require_roles(["Admin", "Production"]))
):
    """Consume packaging materials for filling order"""
    order = await db.filling_orders.find_one({"id": filling_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Filling order not found")
    
    if order["status"] != "In Progress":
        raise HTTPException(status_code=400, detail="Filling order must be In Progress")
    
    material = await find_packaging_material(id=material_id)
    if not material:
        raise HTTPException(status_code=404, detail="Packaging material not found")

    pkg_snapshot = await db.stock_snapshots.find_one({
        "item_id": material_id,
        "item_type": "packaging_material",
        "lot_number": lot_number,
        "status": "Available"
    }, {"_id": 0})
    if not pkg_snapshot:
        raise HTTPException(status_code=404, detail=f"Packaging lot {lot_number} not found or not available")

    # Create consumption transaction
    transaction = InventoryTransactionCreate(
        item_id=material_id,
        item_type="packaging_material",
        lot_number=lot_number,
        location_id=pkg_snapshot["location_id"],
        transaction_type="issue",
        quantity=quantity,
        unit_of_measure=material["unit_of_measure"],
        reference_type="filling_order",
        reference_id=filling_id,
        status="Available"
    )

    await create_inventory_transaction(transaction, user)
    
    # Record consumption
    consumption_record = {
        "id": generate_id(),
        "filling_order_id": filling_id,
        "material_type": "packaging_material",
        "material_id": material_id,
        "lot_number": lot_number,
        "quantity": quantity,
        "created_at": get_timestamp()
    }
    await db.filling_consumptions.insert_one(consumption_record)
    consumption_record.pop("_id", None)

    return {"message": "Packaging consumed", "consumption": consumption_record}

@manufacturing_router.post("/filling-orders/{filling_id}/complete")
async def complete_filling_order(
    filling_id: str,
    actual_quantity: float,
    user: dict = Depends(require_roles(["Admin", "Production"]))
):
    """Complete filling order and produce finished goods"""
    order = await db.filling_orders.find_one({"id": filling_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Filling order not found")
    
    if order["status"] != "In Progress":
        raise HTTPException(status_code=400, detail="Filling order must be In Progress")

    consumption_count = await db.filling_consumptions.count_documents({"filling_order_id": filling_id})
    if consumption_count == 0:
        raise HTTPException(status_code=400, detail="Record WIP and packaging consumption before completing - finished goods can't be produced without consuming real inventory")

    product = await db.products.find_one({"id": order["product_id"]}, {"_id": 0})

    # Create finished goods lot
    fg_lot_number = await generate_lot_number("FG")
    
    # Create inventory transaction for finished goods
    transaction = InventoryTransactionCreate(
        item_id=order["product_id"],
        item_type="finished_good",
        lot_number=fg_lot_number,
        location_id=order["target_location_id"],
        transaction_type="produce",
        quantity=actual_quantity,
        unit_of_measure=product["unit_of_measure"],
        reference_type="filling_order",
        reference_id=filling_id,
        status="Available"
    )
    
    await create_inventory_transaction(transaction, user)
    
    # Update filling order
    await db.filling_orders.update_one(
        {"id": filling_id},
        {"$set": {
            "status": "Completed",
            "actual_quantity": actual_quantity,
            "fg_lot_number": fg_lot_number,
            "completed_at": get_timestamp()
        }}
    )
    
    await broadcast_update("filling.updated", {
        "filling_number": order["filling_number"],
        "status": "Completed",
        "fg_lot_number": fg_lot_number
    })
    
    variance = actual_quantity - order["planned_quantity"]
    variance_percent = (variance / order["planned_quantity"]) * 100 if order["planned_quantity"] > 0 else 0
    
    return {
        "message": "Filling completed",
        "fg_lot_number": fg_lot_number,
        "actual_quantity": actual_quantity,
        "planned_quantity": order["planned_quantity"],
        "variance": variance,
        "variance_percent": round(variance_percent, 2)
    }

@manufacturing_router.post("/filling-orders/{filling_id}/release")
async def release_filling_order(filling_id: str, user: dict = Depends(require_roles(["Admin", "QA"]))):
    order = await db.filling_orders.find_one({"id": filling_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Filling order not found")
    
    await db.filling_orders.update_one({"id": filling_id}, {"$set": {"status": "Released"}})
    await broadcast_update("filling.updated", {"filling_number": order["filling_number"], "status": "Released"})
    return {"message": "Filling order released", "status": "Released"}

@manufacturing_router.delete("/filling-orders/{filling_id}")
async def cancel_filling_order(filling_id: str, user: dict = Depends(require_roles(["Admin"]))):
    """Reverse and delete a filling order at any stage: undoes its WIP/packaging consumption
    and any finished goods it produced by removing the underlying ledger transactions and
    recomputing real stock from what's left, then deletes the order itself. Use this to
    correct a mistaken quantity - there's no in-place edit once real inventory has moved."""
    order = await db.filling_orders.find_one({"id": filling_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Filling order not found")

    txns = await db.inventory_transactions.find(
        {"reference_type": "filling_order", "reference_id": filling_id}, {"_id": 0}
    ).to_list(1000)

    affected = {(t["item_id"], t["item_type"], t["lot_number"], t["location_id"]) for t in txns}

    await db.inventory_transactions.delete_many({"reference_type": "filling_order", "reference_id": filling_id})
    await db.filling_consumptions.delete_many({"filling_order_id": filling_id})
    await db.filling_orders.delete_one({"id": filling_id})

    for item_id, item_type, lot_number, location_id in affected:
        await update_stock_snapshot(item_id, item_type, lot_number, location_id)

    await create_audit_log(user["id"], "cancel", "filling_order", filling_id, {"filling_number": order["filling_number"]})
    await broadcast_update("filling.updated", {"filling_number": order["filling_number"], "status": "Cancelled"})

    return {"message": "Filling order cancelled and reversed", "affected_lots": len(affected)}

# Feasibility Calculator
OZ_TO_KG = 0.0283495  # standard avoirdupois ounce; used to translate KG-of-formula into finished units

@manufacturing_router.get("/feasibility/{product_id}", response_model=FeasibilityResponse)
async def calculate_feasibility(product_id: str, user: dict = Depends(get_current_user)):
    """Calculate max finished, packaged units of a product produceable right now,
    limited by whichever is tighter: raw material stock for its Formula (ingredient
    stage) or packaging material stock for its filling Recipe/BOM (packaging stage).
    Falls back to ingredient-only (KG of formula) if the product has no BOM yet."""
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    formula = await db.formulas.find_one({"product_ids": product_id, "status": "Active"}, {"_id": 0})
    if not formula:
        raise HTTPException(status_code=404, detail="No active formula linked to this product")

    lines = await db.formula_lines.find({"formula_id": formula["id"]}, {"_id": 0}).sort("add_order", 1).to_list(200)
    if not lines:
        raise HTTPException(status_code=404, detail="Formula has no ingredient lines")

    batch_size = formula.get("default_batch_size") or 1.0
    components = []
    ingredient_bottlenecks = []
    max_feasible_kg = float('inf')

    for line in lines:
        qty_required = line.get("default_qty_required") or 0
        percent = line.get("percent") or 0
        if qty_required > 0 and batch_size > 0:
            rate_per_kg = qty_required / batch_size
        elif percent > 0:
            rate_per_kg = percent / 100
        else:
            continue

        rm = await find_raw_material(sku=line.get("raw_material_sku")) or await find_raw_material_by_name(line.get("ingredient_display_name"))
        available = 0
        if rm:
            stock = await db.stock_snapshots.find({
                "item_type": "raw_material",
                "item_id": rm["id"],
                "status": "Available"
            }, {"_id": 0}).to_list(1000)
            available = sum(s.get("quantity_available", 0) for s in stock)

        max_kg_from_line = available / rate_per_kg if rate_per_kg > 0 else 0

        components.append({
            "type": "raw_material",
            "stage": "ingredient",
            "id": rm["id"] if rm else None,
            "name": line.get("ingredient_display_name"),
            "sku": line.get("raw_material_sku"),
            "available": round(available, 3),
            "required_per_unit": round(rate_per_kg, 6),
            "uom": line.get("uom", "KG"),
            "max_units": round(max_kg_from_line, 2)
        })

        if max_kg_from_line < max_feasible_kg:
            max_feasible_kg = max_kg_from_line
        if available <= 0:
            ingredient_bottlenecks.append(f"No {line.get('ingredient_display_name')} available")

    if max_feasible_kg == float('inf'):
        max_feasible_kg = 0

    # Translate KG-of-formula into finished units using the fill size parsed from the
    # product's name/SKU (e.g. "2oz"). Best-effort - falls back to KG-only if unparseable.
    size_match = re.search(r'(\d+(?:\.\d+)?)\s*oz', f"{product.get('name', '')} {product.get('sku', '')}", re.IGNORECASE)
    fill_weight_kg = float(size_match.group(1)) * OZ_TO_KG if size_match else None
    ingredient_max_units = (max_feasible_kg / fill_weight_kg) if fill_weight_kg else None

    # Packaging stage: check the product's filling BOM (Recipe.filling_components), if any
    recipe = await db.recipes.find_one({"product_id": product_id, "is_active": True}, {"_id": 0})
    packaging_max_units = None
    packaging_bottlenecks = []
    if recipe:
        for fc in recipe.get("filling_components", []):
            material = await find_packaging_material(id=fc.get("material_id"))
            if not material:
                continue
            required_per_unit = fc.get("quantity") or 0
            if required_per_unit <= 0:
                continue
            pkg_stock = await db.stock_snapshots.find({
                "item_type": "packaging_material",
                "item_id": fc["material_id"],
                "status": "Available"
            }, {"_id": 0}).to_list(1000)
            total_pkg = sum(s.get("quantity_available", 0) for s in pkg_stock)
            max_from_component = total_pkg / required_per_unit

            components.append({
                "type": "packaging_material",
                "stage": "packaging",
                "id": fc["material_id"],
                "name": material.get("name", "Unknown"),
                "available": round(total_pkg, 2),
                "required_per_unit": round(required_per_unit, 4),
                "uom": material.get("unit_of_measure", "EA"),
                "max_units": round(max_from_component, 1)
            })

            if packaging_max_units is None or max_from_component < packaging_max_units:
                packaging_max_units = max_from_component
            if total_pkg <= 0:
                packaging_bottlenecks.append(f"No {material.get('name', 'Unknown')} available")

    # Combine: finished units are capped by whichever stage is tighter
    candidates = []
    if ingredient_max_units is not None:
        candidates.append(("ingredient", ingredient_max_units, ingredient_bottlenecks))
    if packaging_max_units is not None:
        candidates.append(("packaging", packaging_max_units, packaging_bottlenecks))

    quantity_label = "units"
    if not candidates:
        # No fill-size or no BOM at all - fall back to reporting KG of formula only
        max_feasible_units = max_feasible_kg
        quantity_label = "KG of formula"
        bottleneck = ingredient_bottlenecks[0] if ingredient_bottlenecks else (
            "No packaging BOM found - showing raw KG of formula, not finished units" if fill_weight_kg is None
            else "No filling BOM (Recipe) found for this product yet"
        )
    else:
        limiting_stage, max_feasible_units, stage_bottlenecks = min(candidates, key=lambda c: c[1])
        max_feasible_units = max(0, max_feasible_units)
        if stage_bottlenecks:
            bottleneck = stage_bottlenecks[0]
        else:
            stage_components = [c for c in components if c.get("stage") == limiting_stage]
            limiting = min(stage_components, key=lambda c: c["max_units"]) if stage_components else None
            bottleneck = f"{limiting['name']} limits output to {limiting['max_units']:.1f} {'KG' if limiting_stage == 'ingredient' else 'units'} ({limiting_stage})" if limiting else f"Limited by {limiting_stage} stage"

    return FeasibilityResponse(
        product_id=product_id,
        max_feasible_quantity=round(max_feasible_units, 1),
        quantity_label=quantity_label,
        bottleneck=bottleneck,
        components=components
    )

@manufacturing_router.get("/wip-on-floor")
async def get_wip_on_floor(user: dict = Depends(get_current_user)):
    """Get WIP batches currently on production floor"""
    pipeline = [
        {"$match": {"item_type": "wip_batch", "quantity_on_hand": {"$gt": 0}}},
        {"$lookup": {
            "from": "batch_orders",
            "localField": "lot_number",
            "foreignField": "wip_lot_number",
            "as": "batch_info"
        }},
        {"$lookup": {
            "from": "products",
            "localField": "item_id",
            "foreignField": "id",
            "as": "product_info"
        }},
        {"$lookup": {
            "from": "locations",
            "localField": "location_id",
            "foreignField": "id",
            "as": "location_info"
        }},
        {"$project": {
            "_id": 0,
            "lot_number": 1,
            "quantity_on_hand": 1,
            "quantity_available": 1,
            "status": 1,
            "product_name": {"$arrayElemAt": ["$product_info.name", 0]},
            "location_name": {"$arrayElemAt": ["$location_info.name", 0]},
            "batch_status": {"$arrayElemAt": ["$batch_info.status", 0]}
        }}
    ]
    
    results = await db.stock_snapshots.aggregate(pipeline).to_list(1000)
    
    # Group by status
    by_status = {}
    for r in results:
        status = r.get("batch_status", r.get("status", "Unknown"))
        if status not in by_status:
            by_status[status] = []
        by_status[status].append(r)
    
    return {
        "total_lots": len(results),
        "by_status": by_status,
        "lots": results
    }

# ============ TRACEABILITY ROUTES ============

async def _resolve_item_name(item_id: str, item_type: str, lot_number: str = None) -> str:
    if item_type == "raw_material":
        item = await find_raw_material(id=item_id)
        return item["name"] if item else "Unknown"
    if item_type == "packaging_material":
        item = await find_packaging_material(id=item_id)
        return item["name"] if item else "Unknown"
    if item_type == "wip_batch" and lot_number:
        ws = await db.batching_workspace.find_one({"wip_lot_number": lot_number}, {"_id": 0})
        if ws:
            return f"WIP - {ws.get('formula_name', 'Unknown formula')}"
    return item_type.replace("_", " ").title()


async def _get_lot_info(lot_number: str) -> Optional[dict]:
    """Resolve what item a lot belongs to and its current on-hand quantity, checking
    live stock first and falling back to transaction history for depleted lots."""
    snaps = await db.stock_snapshots.find({"lot_number": lot_number}, {"_id": 0}).to_list(100)
    if snaps:
        item_id = snaps[0]["item_id"]
        item_type = snaps[0]["item_type"]
        qty = sum(s.get("quantity_on_hand", 0) for s in snaps)
        uom = snaps[0].get("unit_of_measure", "")
        status = snaps[0].get("status", "Available")
    else:
        txn = await db.inventory_transactions.find_one({"lot_number": lot_number}, {"_id": 0})
        if not txn:
            return None
        item_id = txn["item_id"]
        item_type = txn["item_type"]
        qty = 0
        uom = txn.get("unit_of_measure", "")
        status = "Depleted"

    return {
        "lot_number": lot_number,
        "item_id": item_id,
        "item_type": item_type,
        "item_name": await _resolve_item_name(item_id, item_type, lot_number),
        "quantity_on_hand": qty,
        "unit_of_measure": uom,
        "status": status,
    }


@traceability_router.get("/forward/{lot_number}")
async def trace_forward(lot_number: str, user: dict = Depends(get_current_user)):
    """Trace a lot forward: what batch was it consumed into, and (if that batch's
    WIP lot was later used in a Filling Order) what finished goods resulted."""
    lot = await _get_lot_info(lot_number)
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found in traceability")

    used_in = []
    async for c in db.batching_consumptions.find({"lot_number": lot_number}, {"_id": 0}):
        ws = await db.batching_workspace.find_one({"id": c["batch_id"]}, {"_id": 0})
        if ws:
            used_in.append({
                "batch_code": ws["batch_code"],
                "formula_name": ws.get("formula_name", ""),
                "qty_used": c.get("actual_qty", 0),
                "uom": lot["unit_of_measure"],
                "created_at": c.get("created_at"),
            })

    # If this lot is itself a WIP lot, see if it was consumed into a Filling Order
    async for fc in db.filling_consumptions.find({"lot_number": lot_number, "material_type": "wip_batch"}, {"_id": 0}):
        filling = await db.filling_orders.find_one({"id": fc["filling_order_id"]}, {"_id": 0})
        if filling:
            used_in.append({
                "batch_code": filling.get("filling_number", ""),
                "formula_name": f"Filling Order (FG lot {filling.get('fg_lot_number', '?')})",
                "qty_used": fc.get("quantity", 0),
                "uom": lot["unit_of_measure"],
                "created_at": filling.get("created_at"),
            })

    transactions = await db.inventory_transactions.find(
        {"lot_number": lot_number}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)

    return {"lot": lot, "used_in": used_in, "transactions": transactions}


@traceability_router.get("/backward/{lot_number}")
async def trace_backward(lot_number: str, user: dict = Depends(get_current_user)):
    """Trace a lot backward to the raw material lots that went into it."""
    lot = await _get_lot_info(lot_number)
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found in traceability")

    source_lots = []

    # Is this lot a WIP lot produced by a batching workspace?
    ws = await db.batching_workspace.find_one({"wip_lot_number": lot_number}, {"_id": 0})
    if ws:
        async for c in db.batching_consumptions.find({"batch_id": ws["id"]}, {"_id": 0}):
            material = await find_raw_material(id=c.get("material_id"))
            source_lots.append({
                "item_name": material["name"] if material else c.get("material_sku", "Unknown"),
                "lot_number": c.get("lot_number", ""),
                "qty_used": c.get("actual_qty", 0),
                "uom": lot["unit_of_measure"],
            })
    else:
        # Is this a finished-good lot from a Filling Order? Trace through its WIP lots.
        filling = await db.filling_orders.find_one({"fg_lot_number": lot_number}, {"_id": 0})
        if filling:
            async for fc in db.filling_consumptions.find({"filling_order_id": filling["id"]}, {"_id": 0}):
                if fc.get("material_type") == "wip_batch":
                    sub_ws = await db.batching_workspace.find_one({"wip_lot_number": fc["lot_number"]}, {"_id": 0})
                    if sub_ws:
                        async for c in db.batching_consumptions.find({"batch_id": sub_ws["id"]}, {"_id": 0}):
                            material = await find_raw_material(id=c.get("material_id"))
                            source_lots.append({
                                "item_name": material["name"] if material else c.get("material_sku", "Unknown"),
                                "lot_number": c.get("lot_number", ""),
                                "qty_used": c.get("actual_qty", 0),
                                "uom": lot["unit_of_measure"],
                            })
                else:
                    material = await find_packaging_material(id=fc.get("material_id"))
                    source_lots.append({
                        "item_name": material["name"] if material else "Unknown packaging",
                        "lot_number": fc.get("lot_number", ""),
                        "qty_used": fc.get("quantity", 0),
                        "uom": lot["unit_of_measure"],
                    })

    transactions = await db.inventory_transactions.find(
        {"lot_number": lot_number}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)

    return {"lot": lot, "source_lots": source_lots, "transactions": transactions}


@traceability_router.get("/where-used/{item_id}")
async def where_used(item_id: str, item_type: Optional[str] = None, user: dict = Depends(get_current_user)):
    """Find every batch an item (by id or SKU) was consumed into."""
    item = (
        await find_raw_material(id=item_id) or await find_raw_material(sku=item_id)
        or await find_packaging_material(id=item_id) or await find_packaging_material(sku=item_id)
    )
    resolved_id = item["id"] if item else item_id

    batches = []
    async for c in db.batching_consumptions.find({"material_id": resolved_id}, {"_id": 0}):
        ws = await db.batching_workspace.find_one({"id": c["batch_id"]}, {"_id": 0})
        if ws:
            batches.append({
                "batch_code": ws["batch_code"],
                "formula_name": ws.get("formula_name", ""),
                "status": ws.get("status", ""),
                "created_at": c.get("created_at"),
            })

    return {"item_id": resolved_id, "item_name": item["name"] if item else item_id, "batches": batches}

# ============ AUDIT LOG ROUTES ============

@api_router.get("/audit-logs")
async def get_audit_logs(
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = Query(100, le=1000),
    current_user: dict = Depends(require_roles(["Admin"]))
):
    query = {}
    if entity_type:
        query["entity_type"] = entity_type
    if entity_id:
        query["entity_id"] = entity_id
    if user_id:
        query["user_id"] = user_id
    
    logs = await db.audit_logs.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return logs

# ============ DASHBOARD ROUTES ============

@api_router.get("/dashboard/summary")
async def get_dashboard_summary(user: dict = Depends(get_current_user)):
    """Get dashboard summary data"""
    # Raw materials summary
    rm_pipeline = [
        {"$match": {"item_type": "raw_material"}},
        {"$group": {
            "_id": None,
            "total_on_hand": {"$sum": "$quantity_on_hand"},
            "total_available": {"$sum": "$quantity_available"},
            "lot_count": {"$sum": 1}
        }}
    ]
    rm_result = await db.stock_snapshots.aggregate(rm_pipeline).to_list(1)
    rm_summary = rm_result[0] if rm_result else {"total_on_hand": 0, "total_available": 0, "lot_count": 0}
    
    # Packaging summary
    pkg_pipeline = [
        {"$match": {"item_type": "packaging_material"}},
        {"$group": {
            "_id": None,
            "total_on_hand": {"$sum": "$quantity_on_hand"},
            "total_available": {"$sum": "$quantity_available"},
            "lot_count": {"$sum": 1}
        }}
    ]
    pkg_result = await db.stock_snapshots.aggregate(pkg_pipeline).to_list(1)
    pkg_summary = pkg_result[0] if pkg_result else {"total_on_hand": 0, "total_available": 0, "lot_count": 0}
    
    # WIP summary
    wip_pipeline = [
        {"$match": {"item_type": "wip_batch"}},
        {"$group": {
            "_id": None,
            "total_on_hand": {"$sum": "$quantity_on_hand"},
            "total_available": {"$sum": "$quantity_available"},
            "lot_count": {"$sum": 1}
        }}
    ]
    wip_result = await db.stock_snapshots.aggregate(wip_pipeline).to_list(1)
    wip_summary = wip_result[0] if wip_result else {"total_on_hand": 0, "total_available": 0, "lot_count": 0}
    
    # Finished goods summary
    fg_pipeline = [
        {"$match": {"item_type": "finished_good"}},
        {"$group": {
            "_id": None,
            "total_on_hand": {"$sum": "$quantity_on_hand"},
            "total_available": {"$sum": "$quantity_available"},
            "lot_count": {"$sum": 1}
        }}
    ]
    fg_result = await db.stock_snapshots.aggregate(fg_pipeline).to_list(1)
    fg_summary = fg_result[0] if fg_result else {"total_on_hand": 0, "total_available": 0, "lot_count": 0}
    
    # Active orders
    batch_orders_active = await db.batch_orders.count_documents({"status": {"$in": ["Planned", "In Progress"]}})
    filling_orders_active = await db.filling_orders.count_documents({"status": {"$in": ["Planned", "In Progress"]}})
    
    # Recent transactions
    recent_transactions = await db.inventory_transactions.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).to_list(10)
    
    return {
        "raw_materials": rm_summary,
        "packaging_materials": pkg_summary,
        "wip_batches": wip_summary,
        "finished_goods": fg_summary,
        "active_batch_orders": batch_orders_active,
        "active_filling_orders": filling_orders_active,
        "recent_transactions": recent_transactions
    }

# ============ SEED DATA ============

# ============ EXCEL SYNC ROUTES ============

from excel_services import ExcelService, ImportPreviewService

# Pydantic models for Excel operations
class ColumnMapping(BaseModel):
    source_column: str
    target_field: str

class MappingConfig(BaseModel):
    name: str
    mapping_type: str  # raw_material, packaging, batching
    sheet_name: str
    mappings: Dict[str, str]

class ImportJobCreate(BaseModel):
    mapping_config_id: Optional[str] = None
    sheet_name: str
    field_mappings: Dict[str, str]

@excel_router.post("/analyze")
async def analyze_excel_file(
    file: UploadFile = File(...),
    user: dict = Depends(require_roles(["Admin", "Warehouse", "Production"]))
):
    """Analyze an uploaded Excel file and return its structure"""
    content = await file.read()
    analysis = ExcelService.analyze_workbook(content)
    return {
        "filename": file.filename,
        "analysis": analysis
    }

@excel_router.post("/suggest-mappings")
async def suggest_field_mappings(
    headers: List[str],
    mapping_type: str = "raw_material",
    user: dict = Depends(get_current_user)
):
    """Suggest field mappings for given column headers"""
    suggestions = ExcelService.suggest_mappings(headers, mapping_type)
    return {"suggestions": suggestions}

@excel_router.post("/mapping-configs")
async def save_mapping_config(
    config: MappingConfig,
    user: dict = Depends(require_roles(["Admin"]))
):
    """Save a column mapping configuration"""
    config_doc = {
        "id": generate_id(),
        "name": config.name,
        "mapping_type": config.mapping_type,
        "sheet_name": config.sheet_name,
        "mappings": config.mappings,
        "created_at": get_timestamp(),
        "created_by": user["id"]
    }
    await db.excel_mapping_configs.insert_one(config_doc)
    return {"id": config_doc["id"], "message": "Mapping config saved"}

@excel_router.get("/mapping-configs")
async def list_mapping_configs(user: dict = Depends(get_current_user)):
    """List all saved mapping configurations"""
    configs = await db.excel_mapping_configs.find({}, {"_id": 0}).to_list(100)
    return configs

@excel_router.post("/preview-import")
async def preview_import(
    file: UploadFile = File(...),
    sheet_name: str = Query(...),
    mapping_type: str = Query("raw_material"),
    user: dict = Depends(require_roles(["Admin", "Warehouse"]))
):
    """Preview what changes would be made by importing an Excel file"""
    content = await file.read()
    
    # Analyze and get suggested mappings
    analysis = ExcelService.analyze_workbook(content)
    sheet_info = next((s for s in analysis["sheets"] if s["name"] == sheet_name), None)
    
    if not sheet_info:
        raise HTTPException(status_code=400, detail=f"Sheet '{sheet_name}' not found")
    
    # Get suggested mappings
    mappings = ExcelService.suggest_mappings(sheet_info["headers"], mapping_type)
    
    # Parse records
    records = ExcelService.parse_excel_to_records(content, sheet_name, mappings)
    
    # Get existing items for comparison
    if mapping_type == "raw_material":
        existing_cursor = db.raw_materials.find({}, {"_id": 0})
        key_field = "sku" if "sku" in mappings.values() else "item_code"
    elif mapping_type == "packaging":
        existing_cursor = db.packaging_materials.find({}, {"_id": 0})
        key_field = "sku" if "sku" in mappings.values() else "item_code"
    else:
        existing_cursor = db.raw_materials.find({}, {"_id": 0})
        key_field = "item_code"
    
    existing_items = {item.get(key_field, item.get("sku", "")): item async for item in existing_cursor}
    
    # Generate preview
    preview = await ImportPreviewService.generate_preview(records, existing_items, key_field)
    
    return {
        "sheet_name": sheet_name,
        "mappings_used": mappings,
        "preview": preview
    }

@excel_router.post("/apply-import")
async def apply_import(
    file: UploadFile = File(...),
    sheet_name: str = Query(...),
    mapping_type: str = Query("raw_material"),
    field_mappings: str = Query(...),  # JSON string
    user: dict = Depends(require_roles(["Admin"]))
):
    """Apply an Excel import to create/update records"""
    content = await file.read()
    mappings = json.loads(field_mappings)
    
    records = ExcelService.parse_excel_to_records(content, sheet_name, mappings)
    
    results = {"created": 0, "updated": 0, "errors": []}
    
    collection = db.raw_materials if mapping_type == "raw_material" else db.packaging_materials
    key_field = "item_code"
    
    for record in records:
        try:
            # Clean record
            clean_record = {k: v for k, v in record.items() if not k.startswith("_") and v is not None}
            
            if not clean_record.get(key_field):
                results["errors"].append(f"Missing {key_field}")
                continue
            
            # Check if exists
            existing = await collection.find_one({key_field: clean_record[key_field]})
            
            if existing:
                # Update
                await collection.update_one(
                    {key_field: clean_record[key_field]},
                    {"$set": clean_record}
                )
                results["updated"] += 1
            else:
                # Create
                clean_record["id"] = generate_id()
                clean_record["is_active"] = True
                clean_record["created_at"] = get_timestamp()
                
                # Map item_code to sku if needed
                if "sku" not in clean_record and "item_code" in clean_record:
                    clean_record["sku"] = clean_record["item_code"]
                
                await collection.insert_one(clean_record)
                results["created"] += 1
        except Exception as e:
            results["errors"].append(str(e))
    
    await create_audit_log(user["id"], "import", mapping_type, "bulk", results)
    
    return results

@excel_router.get("/download-template/{template_type}")
async def download_template(template_type: str, user: dict = Depends(get_current_user)):
    """Download an Excel template for data import"""
    valid_types = ["raw_materials", "packaging", "inventory_receipt"]
    if template_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid template type. Valid: {valid_types}")
    
    content = ExcelService.generate_master_data_template(template_type)
    
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={template_type}_template.xlsx"}
    )

# ============ PRIME POTIONS EXCEL SYNC ENDPOINTS ============

from excel_services import PrimePotionsExcelService

@excel_router.get("/prime-potions/raw-materials")
async def export_raw_materials_prime_potions(user: dict = Depends(get_current_user)):
    """Export Raw Materials in Prime Potions format (RAW-MASTER INV sheet)"""
    # Get all raw materials
    items = await db.items.find({"type": "RAW"}, {"_id": 0}).to_list(10000)
    
    # Also check raw_materials collection for backwards compatibility
    if not items:
        raw_mats = await db.raw_materials.find({}, {"_id": 0}).to_list(10000)
        items = [{"id": r.get("id"), "sku": r.get("sku"), "name": r.get("name"), 
                  "manufacturer": r.get("manufacturer"), "inci_name": r.get("inci_name"),
                  "location": r.get("location"), "unit_of_measure": r.get("unit_of_measure", "KG"),
                  "min_stock_level": r.get("min_stock_level", 0)} for r in raw_mats]
    
    # Get inventory data
    inventory = await db.stock_snapshots.find({"item_type": {"$in": ["RAW", "raw_material"]}}, {"_id": 0}).to_list(10000)
    
    content = PrimePotionsExcelService.generate_raw_materials_excel(items, inventory)
    
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=RAW-Material_Master_Inventory.xlsx"}
    )

@excel_router.get("/prime-potions/packaging")
async def export_packaging_prime_potions(user: dict = Depends(get_current_user)):
    """Export Packaging in Prime Potions format (Master inventory-Packaging sheet)"""
    # Get all packaging materials
    items = await db.items.find({"type": "PACK"}, {"_id": 0}).to_list(10000)
    
    if not items:
        pack_mats = await db.packaging_materials.find({}, {"_id": 0}).to_list(10000)
        items = [{"id": p.get("id"), "name": p.get("name"), "sku": p.get("sku"),
                  "category": p.get("category"), "sub_category": p.get("sub_category"),
                  "supplier": p.get("supplier"), "size_specs": p.get("size_specs"),
                  "unit_of_measure": p.get("unit_of_measure", "EA"),
                  "location": p.get("location"), "min_stock_level": p.get("min_stock_level", 0),
                  "is_active": p.get("is_active", True)} for p in pack_mats]
    
    inventory = await db.stock_snapshots.find({"item_type": {"$in": ["PACK", "packaging_material"]}}, {"_id": 0}).to_list(10000)
    
    content = PrimePotionsExcelService.generate_packaging_excel(items, inventory)
    
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=Master_Inventory_Packaging.xlsx"}
    )

@excel_router.get("/prime-potions/batching-template")
async def export_batching_template(
    formula_id: Optional[str] = None,
    batch_id: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    """
    Export Prime Potions Batching Template
    - If formula_id provided: Pre-fill with formula ingredients
    - If batch_id provided: Pre-fill with workspace data
    """
    batch_info = {
        "batch_code": "",
        "product_name": "",
        "formula_name": "",
        "planned_qty": 0,
        "batch_unit": "KG",
        "batch_date": datetime.now(timezone.utc).strftime("%Y-%m-%d")
    }
    
    formula_lines = []
    
    # If batch_id provided, get workspace data
    if batch_id:
        workspace = await db.batching_workspace.find_one({"id": batch_id}, {"_id": 0})
        if workspace:
            batch_info["batch_code"] = workspace.get("batch_code", "")
            batch_info["formula_name"] = workspace.get("formula_name", "")
            batch_info["product_name"] = workspace.get("formula_name", "")
            batch_info["planned_qty"] = workspace.get("planned_qty", 0)
            batch_info["batch_unit"] = workspace.get("batch_unit", "KG")
            
            # Get formula lines if formula_id exists
            if workspace.get("formula_id"):
                formula_id = workspace["formula_id"]
    
    # Get formula ingredients if formula_id
    if formula_id:
        formula = await db.formulas.find_one({"id": formula_id}, {"_id": 0})
        if formula:
            batch_info["formula_name"] = formula.get("name", "")
            batch_info["product_name"] = formula.get("name", "")
            if not batch_info["planned_qty"]:
                batch_info["planned_qty"] = formula.get("default_batch_size", 0)
            batch_info["batch_unit"] = formula.get("batch_unit", "KG")
            
            lines = await db.formula_lines.find({"formula_id": formula_id}, {"_id": 0}).sort("add_order", 1).to_list(200)
            formula_lines = lines
    
    # Build inventory lookup for VLOOKUP support
    inventory_lookup = []
    raw_items = await db.items.find({"type": "RAW"}, {"_id": 0}).to_list(10000)
    if not raw_items:
        raw_items = await db.raw_materials.find({}, {"_id": 0}).to_list(10000)
    
    # Get on-hand quantities
    for item in raw_items:
        item_id = item.get("id")
        snapshots = await db.stock_snapshots.find({"item_id": item_id}, {"_id": 0}).to_list(100)
        total_on_hand = sum(s.get("quantity_on_hand", 0) for s in snapshots)
        
        inventory_lookup.append({
            "name": item.get("name", ""),
            "sku": item.get("sku", ""),
            "location": item.get("location", ""),
            "unit_of_measure": item.get("unit_of_measure", "KG"),
            "quantity_on_hand": total_on_hand
        })
    
    content = PrimePotionsExcelService.generate_batching_template(batch_info, formula_lines, inventory_lookup)
    
    filename = f"Batching_Sheet_{batch_info.get('batch_code', 'NEW')}.xlsx"
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@excel_router.post("/prime-potions/import-raw-materials")
async def import_raw_materials_prime_potions(
    file: UploadFile = File(...),
    user: dict = Depends(require_roles(["Admin"]))
):
    """
    Import Raw Materials from Prime Potions format (ADMIN ONLY)
    Updates master data only - does NOT create inventory transactions
    """
    content = await file.read()
    parsed = PrimePotionsExcelService.parse_raw_materials_import(content)
    
    if parsed["errors"]:
        raise HTTPException(status_code=400, detail={"message": "Import errors", "errors": parsed["errors"]})
    
    results = {"created": 0, "updated": 0, "skipped": 0, "errors": []}
    
    for item_data in parsed["items"]:
        try:
            sku = item_data.get("sku", "")
            name = item_data.get("name", "")
            
            if not sku and not name:
                results["skipped"] += 1
                continue
            
            # Check if exists
            query = {"sku": sku} if sku else {"name": name}
            existing = await db.items.find_one(query, {"_id": 0})
            
            item_doc = {
                "sku": sku,
                "name": name,
                "type": "RAW",
                "manufacturer": item_data.get("manufacturer", ""),
                "inci_name": item_data.get("inci_name", ""),
                "location": item_data.get("location", ""),
                "secondary_location": item_data.get("secondary_location", ""),
                "unit_of_measure": item_data.get("unit_of_measure", "KG"),
                "min_stock_level": float(item_data.get("min_stock_level", 0) or 0),
                "container_type": item_data.get("container_type", ""),
                "notes": item_data.get("notes", ""),
                "tracking_key": item_data.get("tracking_key", ""),
                "coa_status": item_data.get("coa_status", ""),
                "is_active": True
            }
            
            # Add any custom fields
            for k, v in item_data.items():
                if k.startswith("custom_") and v:
                    item_doc[k] = v
            
            if existing:
                await db.items.update_one(query, {"$set": item_doc})
                results["updated"] += 1
            else:
                item_doc["id"] = generate_id()
                item_doc["created_at"] = get_timestamp()
                await db.items.insert_one(item_doc)
                results["created"] += 1
                
        except Exception as e:
            results["errors"].append(f"Error processing {item_data.get('sku', 'unknown')}: {str(e)}")
    
    await create_audit_log(user["id"], "excel_import", "raw_materials", "bulk", results)
    
    return results

@excel_router.post("/prime-potions/import-packaging")
async def import_packaging_prime_potions(
    file: UploadFile = File(...),
    user: dict = Depends(require_roles(["Admin"]))
):
    """Import Packaging from Prime Potions format (ADMIN ONLY)"""
    content = await file.read()
    parsed = PrimePotionsExcelService.parse_packaging_import(content)
    
    if parsed["errors"]:
        raise HTTPException(status_code=400, detail={"message": "Import errors", "errors": parsed["errors"]})
    
    results = {"created": 0, "updated": 0, "skipped": 0, "errors": []}
    
    for item_data in parsed["items"]:
        try:
            name = item_data.get("name", "")
            if not name:
                results["skipped"] += 1
                continue
            
            existing = await db.items.find_one({"name": name, "type": "PACK"}, {"_id": 0})
            
            item_doc = {
                "name": name,
                "type": "PACK",
                "category": item_data.get("category", ""),
                "sub_category": item_data.get("sub_category", ""),
                "client": item_data.get("client", ""),
                "supplier": item_data.get("supplier", ""),
                "size_specs": item_data.get("size_specs", ""),
                "unit_of_measure": item_data.get("unit_of_measure", "EA"),
                "location": item_data.get("location", ""),
                "min_stock_level": float(item_data.get("min_stock_level", 0) or 0),
                "is_active": str(item_data.get("is_active", "Yes")).lower() in ["yes", "true", "1", "active"]
            }
            
            if existing:
                await db.items.update_one({"name": name, "type": "PACK"}, {"$set": item_doc})
                results["updated"] += 1
            else:
                item_doc["id"] = generate_id()
                item_doc["sku"] = f"PKG-{generate_id()[:8].upper()}"
                item_doc["created_at"] = get_timestamp()
                await db.items.insert_one(item_doc)
                results["created"] += 1
                
        except Exception as e:
            results["errors"].append(f"Error processing {item_data.get('name', 'unknown')}: {str(e)}")
    
    await create_audit_log(user["id"], "excel_import", "packaging", "bulk", results)
    
    return results

@excel_router.post("/prime-potions/import-batching")
async def import_batching_sheet(
    file: UploadFile = File(...),
    formula_id: Optional[str] = None,
    batch_id: Optional[str] = None,
    user: dict = Depends(require_roles(["Admin", "Production"]))
):
    """
    Import completed batching sheet with strict/flexible validation
    
    STRICT MODE (recipe_required=True):
    - Validates ingredient list matches formula exactly
    - Validates quantities within variance_tolerance_percent
    - Rejects if validation fails
    
    FLEXIBLE MODE (recipe_required=False or no formula):
    - Allows manual ingredient rows
    - Only validates ingredient items exist
    """
    content = await file.read()
    parsed = PrimePotionsExcelService.parse_batching_upload(content)
    
    if parsed["errors"]:
        raise HTTPException(status_code=400, detail={
            "message": "Parse errors",
            "errors": parsed["errors"]
        })
    
    # Get formula if provided
    formula = None
    formula_lines = []
    strict_mode = False
    variance_tolerance = 2.0
    
    if formula_id:
        formula = await db.formulas.find_one({"id": formula_id}, {"_id": 0})
        if formula:
            strict_mode = formula.get("recipe_required", False)
            variance_tolerance = formula.get("variance_tolerance_percent", 2.0)
            formula_lines = await db.formula_lines.find(
                {"formula_id": formula_id}, {"_id": 0}
            ).sort("add_order", 1).to_list(200)
    
    # If batch_id provided, get formula from workspace
    if batch_id and not formula:
        workspace = await db.batching_workspace.find_one({"id": batch_id}, {"_id": 0})
        if workspace and workspace.get("formula_id"):
            formula = await db.formulas.find_one({"id": workspace["formula_id"]}, {"_id": 0})
            if formula:
                strict_mode = formula.get("recipe_required", False)
                variance_tolerance = formula.get("variance_tolerance_percent", 2.0)
                formula_lines = await db.formula_lines.find(
                    {"formula_id": formula["id"]}, {"_id": 0}
                ).sort("add_order", 1).to_list(200)
    
    result = {
        "mode": "STRICT" if strict_mode else "FLEXIBLE",
        "validation": {"passed": True, "errors": [], "warnings": []},
        "batch_record": None,
        "consumptions": [],
        "wip_production": None,
        "transactions_created": 0
    }
    
    # Build item lookup by name
    all_items = await db.items.find({"type": "RAW"}, {"_id": 0}).to_list(10000)
    item_by_name = {item.get("name", "").lower().strip(): item for item in all_items}
    item_by_sku = {item.get("sku", "").upper(): item for item in all_items}
    
    # STRICT MODE VALIDATION
    if strict_mode and formula_lines:
        # Build expected ingredients from formula
        expected_ingredients = {
            line.get("ingredient_display_name", "").lower().strip(): line
            for line in formula_lines if not line.get("optional", False)
        }
        
        # Check each uploaded ingredient
        uploaded_ingredients = {}
        for ing in parsed["ingredients"]:
            name_key = ing["ingredient_name"].lower().strip()
            uploaded_ingredients[name_key] = ing
        
        # Check for missing required ingredients
        for name, line in expected_ingredients.items():
            if name not in uploaded_ingredients:
                result["validation"]["errors"].append({
                    "type": "MISSING_INGREDIENT",
                    "ingredient": line.get("ingredient_display_name"),
                    "message": f"Required ingredient '{line.get('ingredient_display_name')}' not found in upload"
                })
        
        # Check for extra ingredients
        for name, ing in uploaded_ingredients.items():
            if name not in expected_ingredients:
                # Check if it's optional
                optional_line = next(
                    (l for l in formula_lines 
                     if l.get("ingredient_display_name", "").lower().strip() == name and l.get("optional")),
                    None
                )
                if not optional_line:
                    result["validation"]["warnings"].append({
                        "type": "EXTRA_INGREDIENT",
                        "ingredient": ing["ingredient_name"],
                        "message": f"Ingredient '{ing['ingredient_name']}' not in recipe (will be added anyway)"
                    })
        
        # Check quantities within tolerance
        for name, ing in uploaded_ingredients.items():
            if name in expected_ingredients:
                expected_qty = expected_ingredients[name].get("default_qty_required", 0)
                actual_qty = ing.get("actual_qty") or ing.get("qty_required", 0)
                
                if expected_qty > 0 and actual_qty > 0:
                    variance_pct = abs(actual_qty - expected_qty) / expected_qty * 100
                    if variance_pct > variance_tolerance:
                        result["validation"]["errors"].append({
                            "type": "QTY_VARIANCE",
                            "ingredient": ing["ingredient_name"],
                            "expected": expected_qty,
                            "actual": actual_qty,
                            "variance_percent": round(variance_pct, 2),
                            "tolerance": variance_tolerance,
                            "message": f"Qty variance {variance_pct:.1f}% exceeds tolerance {variance_tolerance}%"
                        })
        
        # If strict validation fails, return errors
        if result["validation"]["errors"]:
            result["validation"]["passed"] = False
            raise HTTPException(status_code=400, detail={
                "message": "Strict recipe validation failed",
                "result": result
            })
    
    # FLEXIBLE MODE - Just validate items exist
    else:
        for ing in parsed["ingredients"]:
            name_key = ing["ingredient_name"].lower().strip()
            sku_key = ing["ingredient_name"].upper()
            
            if name_key not in item_by_name and sku_key not in item_by_sku:
                result["validation"]["warnings"].append({
                    "type": "UNKNOWN_ITEM",
                    "ingredient": ing["ingredient_name"],
                    "message": f"Item '{ing['ingredient_name']}' not found - will skip consumption"
                })
    
    # CREATE BATCH RECORD
    batch_code = parsed["batch_info"].get("batch_code") or f"BATCH-{datetime.now(timezone.utc).strftime('%y%m%d')}-{generate_id()[:4].upper()}"
    
    batch_record = {
        "id": generate_id(),
        "batch_code": batch_code,
        "formula_id": formula["id"] if formula else None,
        "formula_name": formula["name"] if formula else parsed["batch_info"].get("product_name", "Manual Batch"),
        "status": "Completed",
        "planned_qty": sum(ing.get("qty_required", 0) for ing in parsed["ingredients"]),
        "actual_qty": parsed.get("finish_weight") or sum(ing.get("actual_qty") or ing.get("qty_required", 0) for ing in parsed["ingredients"]),
        "batch_unit": "KG",
        "created_at": get_timestamp(),
        "created_by": user["id"],
        "completed_at": get_timestamp(),
        "source": "excel_import"
    }
    
    await db.batches.insert_one(batch_record)
    batch_record.pop("_id", None)
    result["batch_record"] = batch_record
    
    # CREATE CONSUMPTION RECORDS + TRANSACTIONS
    for ing in parsed["ingredients"]:
        name_key = ing["ingredient_name"].lower().strip()
        sku_key = ing["ingredient_name"].upper()
        
        item = item_by_name.get(name_key) or item_by_sku.get(sku_key)
        if not item:
            continue
        
        actual_qty = ing.get("actual_qty") or ing.get("qty_required", 0)
        if not actual_qty or actual_qty <= 0:
            continue
        
        # Create consumption record
        consumption = {
            "id": generate_id(),
            "batch_id": batch_record["id"],
            "item_id": item["id"],
            "item_sku": item.get("sku", ""),
            "item_name": item.get("name", ""),
            "qty_used": actual_qty,
            "uom": item.get("unit_of_measure", "KG"),
            "lot_code": ing.get("lot_code", ""),
            "process_notes": ing.get("process_notes", ""),
            "batch_notes": ing.get("batch_notes", ""),
            "created_at": get_timestamp()
        }
        await db.batch_consumptions.insert_one(consumption)
        consumption.pop("_id", None)
        result["consumptions"].append(consumption)
        
        # Create ISSUE transaction (negative qty)
        transaction = {
            "id": generate_id(),
            "transaction_type": "ISSUE",
            "item_id": item["id"],
            "item_sku": item.get("sku", ""),
            "item_name": item.get("name", ""),
            "quantity": -actual_qty,
            "unit_of_measure": item.get("unit_of_measure", "KG"),
            "reference_type": "batch",
            "reference_id": batch_record["id"],
            "reference_code": batch_code,
            "notes": f"Consumed for batch {batch_code}",
            "created_at": get_timestamp(),
            "created_by": user["id"]
        }
        await db.inventory_transactions.insert_one(transaction)
        result["transactions_created"] += 1
        
        # Update stock snapshot
        await db.stock_snapshots.update_one(
            {"item_id": item["id"]},
            {"$inc": {"quantity_on_hand": -actual_qty, "quantity_available": -actual_qty}},
            upsert=True
        )
    
    # CREATE WIP PRODUCTION (if finish weight provided)
    if parsed.get("finish_weight") and parsed["finish_weight"] > 0:
        wip_item = {
            "id": generate_id(),
            "sku": f"WIP-{batch_code}",
            "name": f"WIP - {batch_record['formula_name']}",
            "type": "WIP",
            "created_at": get_timestamp()
        }
        await db.items.insert_one(wip_item)
        wip_item.pop("_id", None)  # Remove MongoDB _id
        
        wip_transaction = {
            "id": generate_id(),
            "transaction_type": "PRODUCE",
            "item_id": wip_item["id"],
            "item_sku": wip_item["sku"],
            "item_name": wip_item["name"],
            "quantity": parsed["finish_weight"],
            "unit_of_measure": "KG",
            "lot_number": batch_code,
            "reference_type": "batch",
            "reference_id": batch_record["id"],
            "reference_code": batch_code,
            "notes": f"Produced from batch {batch_code}",
            "created_at": get_timestamp(),
            "created_by": user["id"]
        }
        await db.inventory_transactions.insert_one(wip_transaction)
        result["transactions_created"] += 1
        
        # Create stock snapshot for WIP
        wip_snapshot = {
            "item_id": wip_item["id"],
            "item_type": "WIP",
            "lot_number": batch_code,
            "quantity_on_hand": parsed["finish_weight"],
            "quantity_available": parsed["finish_weight"],
            "quantity_reserved": 0,
            "status": "Available",
            "created_at": get_timestamp()
        }
        await db.stock_snapshots.insert_one(wip_snapshot)
        
        result["wip_production"] = {
            "item": {k: v for k, v in wip_item.items() if k != "_id"},
            "quantity": parsed["finish_weight"],
            "lot_number": batch_code
        }
    
    # Broadcast updates
    await broadcast_update("inventory.updated", {"batch_id": batch_record["id"]})
    await broadcast_update("batch.updated", {"batch_id": batch_record["id"], "status": "Completed"})
    
    await create_audit_log(user["id"], "batching_import", "batch", batch_record["id"], result)
    
    return result

@excel_router.post("/import-wizard/analyze")
async def analyze_excel_for_wizard(
    file: UploadFile = File(...),
    user: dict = Depends(require_roles(["Admin"]))
):
    """
    Step 1 of Import Wizard: Analyze uploaded Excel file
    Returns sheet names, headers, and suggested mappings
    """
    content = await file.read()
    
    analysis = ExcelService.analyze_workbook(content)
    
    # For each sheet, suggest mappings
    for sheet in analysis["sheets"]:
        # Determine likely data type
        headers_lower = [h.lower() for h in sheet["headers"]]
        
        if any("ingredient" in h or "inci" in h or "raw" in h for h in headers_lower):
            sheet["suggested_type"] = "raw_materials"
            sheet["suggested_mappings"] = ExcelService.suggest_mappings(sheet["headers"], "raw_material")
        elif any("packaging" in h or "pack" in h for h in headers_lower):
            sheet["suggested_type"] = "packaging"
            sheet["suggested_mappings"] = ExcelService.suggest_mappings(sheet["headers"], "packaging")
        elif any("batch" in h or "formula" in h for h in headers_lower):
            sheet["suggested_type"] = "batching"
            sheet["suggested_mappings"] = {}
        else:
            sheet["suggested_type"] = "unknown"
            sheet["suggested_mappings"] = ExcelService.suggest_mappings(sheet["headers"], "raw_material")
    
    return {
        "filename": file.filename,
        "analysis": analysis,
        "total_sheets": len(analysis["sheets"]),
        "supported_types": ["raw_materials", "packaging", "batching", "inventory_receipt"]
    }

@excel_router.post("/import-wizard/preview")
async def preview_import_wizard(
    file: UploadFile = File(...),
    sheet_name: str = Query(...),
    data_type: str = Query(...),
    field_mappings: str = Query(...),  # JSON string
    user: dict = Depends(require_roles(["Admin"]))
):
    """
    Step 2 of Import Wizard: Preview changes
    Shows what will be created/updated/skipped
    """
    content = await file.read()
    mappings = json.loads(field_mappings)
    
    # Parse records using provided mappings
    records = ExcelService.parse_excel_to_records(content, sheet_name, mappings)
    
    # Get existing items for comparison
    existing_items = {}
    if data_type == "raw_materials":
        items = await db.items.find({"type": "RAW"}, {"_id": 0}).to_list(10000)
        existing_items = {item.get("sku", ""): item for item in items if item.get("sku")}
        key_field = "item_code"
    elif data_type == "packaging":
        items = await db.items.find({"type": "PACK"}, {"_id": 0}).to_list(10000)
        existing_items = {item.get("name", ""): item for item in items if item.get("name")}
        key_field = "name"
    elif data_type == "inventory_receipt":
        key_field = "lot_number"
    else:
        key_field = "item_code"
    
    # Generate preview
    preview = await ImportPreviewService.generate_preview(records, existing_items, key_field)
    
    return {
        "sheet_name": sheet_name,
        "data_type": data_type,
        "preview": preview,
        "summary": {
            "to_create": len(preview["to_create"]),
            "to_update": len(preview["to_update"]),
            "unchanged": len(preview["unchanged"]),
            "errors": len(preview["errors"])
        }
    }

@excel_router.post("/import-wizard/apply")
async def apply_import_wizard(
    file: UploadFile = File(...),
    sheet_name: str = Query(...),
    data_type: str = Query(...),
    field_mappings: str = Query(...),
    user: dict = Depends(require_roles(["Admin"]))
):
    """
    Step 3 of Import Wizard: Apply the import
    Creates/updates records based on mappings
    """
    content = await file.read()
    mappings = json.loads(field_mappings)
    
    records = ExcelService.parse_excel_to_records(content, sheet_name, mappings)
    
    results = {"created": 0, "updated": 0, "skipped": 0, "errors": []}
    
    for record in records:
        try:
            if data_type == "raw_materials":
                sku = record.get("item_code", "")
                name = record.get("name", "")
                
                if not sku and not name:
                    results["skipped"] += 1
                    continue
                
                query = {"sku": sku, "type": "RAW"} if sku else {"name": name, "type": "RAW"}
                existing = await db.items.find_one(query, {"_id": 0})
                
                item_doc = {
                    "sku": sku or f"RM-{generate_id()[:8].upper()}",
                    "name": name,
                    "type": "RAW",
                    "manufacturer": record.get("manufacturer", ""),
                    "inci_name": record.get("inci_name", ""),
                    "location": record.get("location", ""),
                    "unit_of_measure": record.get("uom", "KG"),
                    "min_stock_level": float(record.get("minimum_stock", 0) or 0),
                    "category": record.get("category", ""),
                    "is_active": True
                }
                
                if existing:
                    await db.items.update_one(query, {"$set": item_doc})
                    results["updated"] += 1
                else:
                    item_doc["id"] = generate_id()
                    item_doc["created_at"] = get_timestamp()
                    await db.items.insert_one(item_doc)
                    results["created"] += 1
                    
            elif data_type == "packaging":
                name = record.get("name", "")
                if not name:
                    results["skipped"] += 1
                    continue
                
                existing = await db.items.find_one({"name": name, "type": "PACK"}, {"_id": 0})
                
                item_doc = {
                    "name": name,
                    "type": "PACK",
                    "category": record.get("category", ""),
                    "sub_category": record.get("sub_category", ""),
                    "supplier": record.get("supplier", ""),
                    "size_specs": record.get("size_specs", ""),
                    "unit_of_measure": record.get("uom", "EA"),
                    "location": record.get("location", ""),
                    "min_stock_level": float(record.get("minimum_stock", 0) or 0),
                    "is_active": True
                }
                
                if existing:
                    await db.items.update_one({"name": name, "type": "PACK"}, {"$set": item_doc})
                    results["updated"] += 1
                else:
                    item_doc["id"] = generate_id()
                    item_doc["sku"] = f"PKG-{generate_id()[:8].upper()}"
                    item_doc["created_at"] = get_timestamp()
                    await db.items.insert_one(item_doc)
                    results["created"] += 1

            elif data_type == "inventory_receipt":
                sku = (record.get("item_code") or "").strip()
                lot_number = (record.get("lot_number") or "").strip()
                quantity = record.get("quantity")
                location_code = (record.get("location") or "").strip()

                if not sku:
                    results["skipped"] += 1
                    continue

                try:
                    quantity = float(quantity) if quantity not in (None, "") else 0.0
                except (TypeError, ValueError):
                    quantity = 0.0

                if quantity <= 0:
                    results["skipped"] += 1
                    continue

                item = await db.items.find_one({"sku": sku}, {"_id": 0})
                if not item:
                    results["errors"].append(f"Unknown item code: {sku}")
                    continue

                location = await db.locations.find_one({"code": location_code}, {"_id": 0}) if location_code else None
                if not location:
                    results["errors"].append(f"Unknown location '{location_code}' for item {sku}")
                    continue

                if not lot_number:
                    lot_number = await generate_lot_number("RM" if item.get("type") == "RAW" else "PKG")

                item_type = "raw_material" if item.get("type") == "RAW" else "packaging_material"

                existing_txn = await db.inventory_transactions.find_one({
                    "item_id": item["id"],
                    "lot_number": lot_number,
                    "location_id": location["id"],
                    "transaction_type": "receive",
                    "reference_type": "excel_import"
                }, {"_id": 0})
                if existing_txn:
                    results["skipped"] += 1
                    continue

                notes = f"Imported from {sheet_name}"
                expiry_date = record.get("expiry_date")
                if expiry_date:
                    notes += f" | Expiry: {expiry_date}"

                transaction = InventoryTransactionCreate(
                    item_id=item["id"],
                    item_type=item_type,
                    lot_number=lot_number,
                    location_id=location["id"],
                    transaction_type="receive",
                    quantity=quantity,
                    unit_of_measure=record.get("uom") or item.get("unit_of_measure", "KG"),
                    reference_type="excel_import",
                    status="Available",
                    notes=notes
                )
                await create_inventory_transaction(transaction, user)
                results["created"] += 1

        except Exception as e:
            results["errors"].append(str(e))

    await create_audit_log(user["id"], "import_wizard", data_type, "bulk", results)

    return results

# ============ BATCHING WORKSPACE ROUTES ============

class BatchingWorkspaceCreate(BaseModel):
    formula_id: Optional[str] = None
    formula_name: str
    planned_qty: float
    batch_unit: str = "KG"
    target_location_id: str
    notes: Optional[str] = ""

class BatchingSheetUpload(BaseModel):
    batch_id: str
    actual_batch_size: float
    ingredients_consumed: List[Dict[str, Any]]
    lot_splits: Optional[List[Dict[str, Any]]] = []

@batching_router.get("/workspace")
async def list_batching_workspaces(
    status: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    """List all batching workspace entries"""
    query = {}
    if status:
        query["status"] = status
    
    batches = await db.batching_workspace.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return batches

@batching_router.post("/workspace")
async def create_batching_workspace(
    data: BatchingWorkspaceCreate,
    user: dict = Depends(require_roles(["Admin", "Production"]))
):
    """Create a new batching workspace entry"""
    batch_code = await generate_lot_number("BATCH")
    
    # Get formula ingredients if formula exists
    ingredients = []
    formula_revision = ""
    if data.formula_id:
        formula = await db.formulas.find_one({"id": data.formula_id}, {"_id": 0})
        if formula:
            formula_revision = formula.get("description", "") or ""
            lines = await db.formula_lines.find({"formula_id": data.formula_id}, {"_id": 0}).to_list(100)
            for line in lines:
                rm = await find_raw_material(sku=line.get("raw_material_sku"))
                # Prefer an explicit default_qty_required (what the Formulas UI collects);
                # only fall back to percent-of-batch scaling when no fixed qty was set.
                default_qty = line.get("default_qty_required", 0) or 0
                percent = line.get("percent", 0) or 0
                planned_qty = default_qty if default_qty > 0 else (percent / 100) * data.planned_qty
                ingredients.append({
                    "sku": line.get("raw_material_sku"),
                    "name": rm.get("name") if rm else line.get("raw_material_sku"),
                    "phase": line.get("phase", ""),
                    "percent": percent,
                    "planned_qty": planned_qty,
                    "uom": line.get("uom", "KG"),
                    "add_order": line.get("add_order", ""),
                    "process_notes": line.get("process_notes", ""),
                    "batch_notes": line.get("batch_notes", "")
                })
    
    workspace = {
        "id": generate_id(),
        "batch_code": batch_code,
        "formula_id": data.formula_id,
        "formula_name": data.formula_name,
        "formula_revision": formula_revision,
        "planned_qty": data.planned_qty,
        "actual_qty": None,
        "batch_unit": data.batch_unit,
        "target_location_id": data.target_location_id,
        "status": "Planned",
        "notes": data.notes or "",
        "ingredients": ingredients,
        "created_at": get_timestamp(),
        "created_by": user["id"],
        "completed_at": None
    }
    
    await db.batching_workspace.insert_one(workspace)
    await broadcast_update("batch.updated", {"batch_code": batch_code, "status": "Planned"})

    # Remove _id if MongoDB added it
    workspace.pop("_id", None)
    return workspace

@batching_router.put("/workspace/{batch_id}")
async def update_batching_workspace(batch_id: str, data: BatchingWorkspaceCreate, user: dict = Depends(require_roles(["Admin"]))):
    """Edit a batching workspace entry. Before any real consumption has happened
    (status still Planned), everything is editable and ingredients are recalculated
    from the chosen formula. Once real stock has been consumed (status past Planned),
    only notes and location can change - the formula/quantity are already reflected
    in real inventory transactions and can't be silently rewritten."""
    existing = await db.batching_workspace.find_one({"id": batch_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Batching workspace not found")

    if existing["status"] != "Planned":
        update_fields = {
            "target_location_id": data.target_location_id,
            "notes": data.notes or ""
        }
    else:
        ingredients = []
        formula_revision = ""
        if data.formula_id:
            formula = await db.formulas.find_one({"id": data.formula_id}, {"_id": 0})
            if formula:
                formula_revision = formula.get("description", "") or ""
                lines = await db.formula_lines.find({"formula_id": data.formula_id}, {"_id": 0}).to_list(100)
                for line in lines:
                    rm = await find_raw_material(sku=line.get("raw_material_sku"))
                    default_qty = line.get("default_qty_required", 0) or 0
                    percent = line.get("percent", 0) or 0
                    planned_qty = default_qty if default_qty > 0 else (percent / 100) * data.planned_qty
                    ingredients.append({
                        "sku": line.get("raw_material_sku"),
                        "name": rm.get("name") if rm else line.get("raw_material_sku"),
                        "phase": line.get("phase", ""),
                        "percent": percent,
                        "planned_qty": planned_qty,
                        "uom": line.get("uom", "KG"),
                        "add_order": line.get("add_order", ""),
                        "process_notes": line.get("process_notes", ""),
                        "batch_notes": line.get("batch_notes", "")
                    })
        update_fields = {
            "formula_id": data.formula_id,
            "formula_name": data.formula_name,
            "formula_revision": formula_revision,
            "planned_qty": data.planned_qty,
            "batch_unit": data.batch_unit,
            "target_location_id": data.target_location_id,
            "notes": data.notes or "",
            "ingredients": ingredients
        }

    result = await db.batching_workspace.find_one_and_update(
        {"id": batch_id},
        {"$set": update_fields},
        return_document=True
    )
    await create_audit_log(user["id"], "update", "batching_workspace", batch_id, update_fields)
    await broadcast_update("batch.updated", {"batch_code": result["batch_code"], "status": result["status"]})
    result.pop("_id", None)
    return result

@batching_router.delete("/workspace/{batch_id}")
async def delete_batching_workspace(batch_id: str, user: dict = Depends(require_roles(["Admin"]))):
    """Delete a batching workspace entry, reversing any real consumption it caused
    (raw materials given back, WIP removed) by deleting its ledger transactions and
    recomputing stock from what's left - same pattern as cancelling a filling order.
    Blocked if this batch's WIP has already been consumed by a Filling Order, since
    reversing it then would corrupt that downstream record."""
    existing = await db.batching_workspace.find_one({"id": batch_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Batching workspace not found")

    wip_lot_number = existing.get("wip_lot_number")
    if wip_lot_number:
        downstream = await db.filling_consumptions.find_one({"material_type": "wip_batch", "lot_number": wip_lot_number})
        if downstream:
            raise HTTPException(status_code=400, detail="This batch's WIP has already been used in a Filling Order - cancel that Filling Order first")

    txns = await db.inventory_transactions.find(
        {"reference_type": "batching_workspace", "reference_id": batch_id}, {"_id": 0}
    ).to_list(1000)
    affected = {(t["item_id"], t["item_type"], t["lot_number"], t["location_id"]) for t in txns}

    await db.inventory_transactions.delete_many({"reference_type": "batching_workspace", "reference_id": batch_id})
    await db.batching_consumptions.delete_many({"batch_id": batch_id})
    await db.batching_workspace.delete_one({"id": batch_id})

    for item_id, item_type, lot_number, location_id in affected:
        await update_stock_snapshot(item_id, item_type, lot_number, location_id)

    await create_audit_log(user["id"], "delete", "batching_workspace", batch_id, {"batch_code": existing["batch_code"]})
    await broadcast_update("batch.updated", {"batch_code": existing["batch_code"], "status": "Deleted"})

    return {"message": "Batch deleted and reversed", "affected_lots": len(affected)}

@batching_router.get("/workspace/{batch_id}")
async def get_batching_workspace(batch_id: str, user: dict = Depends(get_current_user)):
    """Get a specific batching workspace entry"""
    workspace = await db.batching_workspace.find_one({"id": batch_id}, {"_id": 0})
    if not workspace:
        raise HTTPException(status_code=404, detail="Batching workspace not found")
    return workspace

@batching_router.get("/workspace/{batch_id}/download-sheet")
async def download_batching_sheet(batch_id: str, user: dict = Depends(get_current_user)):
    """Download the batching Excel sheet for a workspace entry"""
    workspace = await db.batching_workspace.find_one({"id": batch_id}, {"_id": 0})
    if not workspace:
        raise HTTPException(status_code=404, detail="Batching workspace not found")
    
    # Get current inventory snapshot for raw materials
    locations_by_id = {loc["id"]: loc async for loc in db.locations.find({}, {"_id": 0})}
    inventory_snapshot = []
    stock_cursor = db.stock_snapshots.find(
        {"item_type": "raw_material", "quantity_available": {"$gt": 0}},
        {"_id": 0}
    )
    async for stock in stock_cursor:
        # Get material info
        rm = await find_raw_material(id=stock.get("item_id"))
        if rm:
            location = locations_by_id.get(stock.get("location_id"), {})
            inventory_snapshot.append({
                "sku": rm.get("sku", ""),
                "name": rm.get("name", ""),
                "lot_number": stock.get("lot_number", ""),
                "location": location.get("code") or location.get("name") or stock.get("location_id", ""),
                "quantity_available": stock.get("quantity_available", 0),
                "uom": rm.get("unit_of_measure", ""),
                "status": stock.get("status", ""),
                "expiry_date": ""
            })
    
    # Generate batching sheet
    batch_info = {
        "batch_code": workspace["batch_code"],
        "product_name": workspace["formula_name"],
        "formula_name": workspace["formula_name"],
        "formula_revision": workspace.get("formula_revision", ""),
        "planned_qty": workspace["planned_qty"],
        "batch_unit": workspace["batch_unit"],
        "batch_date": workspace["created_at"][:10] if workspace.get("created_at") else datetime.now(timezone.utc).strftime("%Y-%m-%d")
    }

    # Workspace ingredients use sku/name/planned_qty; the template writer expects
    # ingredient_display_name/default_qty_required (same field names formula_lines use)
    formula_lines = [
        {
            "ingredient_display_name": ing.get("name") or ing.get("sku", ""),
            "default_qty_required": ing.get("planned_qty", 0),
            "add_order": ing.get("add_order", ""),
            "process_notes": ing.get("process_notes", ""),
            "batch_notes": ing.get("batch_notes", ""),
            "percent": ing.get("percent", "")
        }
        for ing in workspace.get("ingredients", [])
    ]

    inventory_lookup = [
        {
            "name": snap["name"],
            "sku": snap["sku"],
            "location": snap["location"],
            "unit_of_measure": snap["uom"],
            "quantity_on_hand": snap["quantity_available"]
        }
        for snap in inventory_snapshot
    ]

    content = PrimePotionsExcelService.generate_batching_template(batch_info, formula_lines, inventory_lookup)
    
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=batching_{workspace['batch_code']}.xlsx"}
    )

@batching_router.post("/workspace/{batch_id}/upload-sheet")
async def upload_batching_sheet(
    batch_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(require_roles(["Admin", "Production"]))
):
    """Upload a completed batching sheet to record consumption"""
    workspace = await db.batching_workspace.find_one({"id": batch_id}, {"_id": 0})
    if not workspace:
        raise HTTPException(status_code=404, detail="Batching workspace not found")
    
    content = await file.read()
    parsed = PrimePotionsExcelService.parse_batching_upload(content)

    if parsed["errors"]:
        raise HTTPException(status_code=400, detail={"errors": parsed["errors"]})

    # Actual batch size = FINISH WT if the user filled it in, else the sum of actual qty entered per ingredient
    actual_batch_size = parsed.get("finish_weight") or sum(
        (ing.get("actual_qty") or 0) for ing in parsed["ingredients"]
    )
    if not actual_batch_size:
        raise HTTPException(
            status_code=400,
            detail="No quantities found. Fill in the 'Added' column (and/or 'FINISH WT') before uploading."
        )

    warnings = list(parsed.get("warnings", []))

    # Process consumptions - the sheet identifies ingredients by name (no SKU/lot column exists in the template)
    consumptions_created = []
    transactions_created = []

    for ing in parsed["ingredients"]:
        actual_qty = ing.get("actual_qty")
        if not actual_qty or actual_qty <= 0:
            continue

        ingredient_name = ing.get("ingredient_name", "")
        rm = await find_raw_material(sku=ingredient_name) or await find_raw_material_by_name(ingredient_name)
        if not rm:
            warnings.append(f"Material not found: {ingredient_name}")
            continue

        actual_qty = float(actual_qty)

        # The batching sheet has no lot column (it mirrors Prime Potions' paper form), so
        # draw from the material's real lots oldest-first rather than inventing a blank lot.
        result = await consume_raw_material_fifo(
            item_id=rm["id"],
            unit_of_measure=rm.get("unit_of_measure", "KG"),
            qty_needed=actual_qty,
            reference_type="batching_workspace",
            reference_id=batch_id,
            notes=f"Batching consumption for {workspace['batch_code']}",
            user_id=user["id"]
        )
        transactions_created.extend(l["transaction_id"] for l in result["consumed_lots"])
        if result["shortfall"] > 0:
            warnings.append(
                f"{ingredient_name}: only {result['quantity_consumed']:.3f} of {actual_qty:.3f} {rm.get('unit_of_measure', 'KG')} "
                f"was available in stock - recorded a shortfall of {result['shortfall']:.3f}."
            )

        # Record consumption (one record per lot actually drawn from)
        for lot in result["consumed_lots"]:
            consumption = {
                "id": generate_id(),
                "batch_id": batch_id,
                "material_id": rm["id"],
                "material_sku": rm.get("sku"),
                "lot_number": lot["lot_number"],
                "planned_qty": ing.get("qty_required", 0),
                "actual_qty": lot["quantity"],
                "variance": lot["quantity"] - float(ing.get("qty_required", 0) or 0),
                "created_at": get_timestamp()
            }
            await db.batching_consumptions.insert_one(consumption)
            consumptions_created.append(consumption["id"])

    if not consumptions_created and parsed["ingredients"]:
        warnings.append("No ingredient quantities were recorded - none of the 'Added' column values matched a known material.")

    # Create WIP production
    wip_lot_number = await generate_lot_number("WIP")
    
    # Get product if formula links to one (a formula can link to several packaged
    # products - e.g. tube + jar - but the WIP itself is bulk/unpackaged, so it's
    # tracked under the first linked product as a stand-in until filling/packaging exists)
    product_id = None
    if workspace.get("formula_id"):
        formula = await db.formulas.find_one({"id": workspace["formula_id"]}, {"_id": 0})
        if formula:
            product_ids = formula.get("product_ids") or []
            product_id = product_ids[0] if product_ids else None
    
    wip_transaction = {
        "id": generate_id(),
        "item_id": product_id or workspace["id"],
        "item_type": "wip_batch",
        "lot_number": wip_lot_number,
        "location_id": workspace["target_location_id"],
        "transaction_type": "produce",
        "quantity": float(actual_batch_size),
        "unit_of_measure": workspace["batch_unit"],
        "reference_type": "batching_workspace",
        "reference_id": batch_id,
        "status": "Available",
        "notes": f"WIP produced from {workspace['batch_code']}",
        "created_at": get_timestamp(),
        "created_by": user["id"]
    }
    await db.inventory_transactions.insert_one(wip_transaction)
    await update_stock_snapshot(product_id or workspace["id"], "wip_batch", wip_lot_number, workspace["target_location_id"])
    
    # Update workspace
    await db.batching_workspace.update_one(
        {"id": batch_id},
        {"$set": {
            "status": "Completed",
            "actual_qty": float(actual_batch_size),
            "wip_lot_number": wip_lot_number,
            "completed_at": get_timestamp()
        }}
    )
    
    await broadcast_update("batch.updated", {
        "batch_code": workspace["batch_code"],
        "status": "Completed",
        "wip_lot_number": wip_lot_number
    })
    await broadcast_update("inventory.updated", {"item_type": "raw_material"})
    
    variance = float(actual_batch_size) - workspace["planned_qty"]
    variance_percent = (variance / workspace["planned_qty"]) * 100 if workspace["planned_qty"] > 0 else 0
    
    return {
        "message": "Batching sheet processed successfully",
        "batch_code": workspace["batch_code"],
        "wip_lot_number": wip_lot_number,
        "actual_qty": actual_batch_size,
        "variance": round(variance, 3),
        "variance_percent": round(variance_percent, 2),
        "consumptions_created": len(consumptions_created),
        "transactions_created": len(transactions_created),
        "warnings": warnings
    }

@batching_router.post("/workspace/{batch_id}/start")
async def start_batching(batch_id: str, user: dict = Depends(require_roles(["Admin", "Production"]))):
    """Mark a batching workspace as In Progress"""
    workspace = await db.batching_workspace.find_one({"id": batch_id}, {"_id": 0})
    if not workspace:
        raise HTTPException(status_code=404, detail="Batching workspace not found")
    
    await db.batching_workspace.update_one(
        {"id": batch_id},
        {"$set": {"status": "In Progress"}}
    )
    await broadcast_update("batch.updated", {"batch_code": workspace["batch_code"], "status": "In Progress"})
    
    return {"message": "Batching started", "status": "In Progress"}

@batching_router.post("/workspace/{batch_id}/qa-hold")
async def qa_hold_batching(batch_id: str, user: dict = Depends(require_roles(["Admin", "QA"]))):
    """Place a completed batch on QA hold"""
    workspace = await db.batching_workspace.find_one({"id": batch_id}, {"_id": 0})
    if not workspace:
        raise HTTPException(status_code=404, detail="Batching workspace not found")
    
    await db.batching_workspace.update_one(
        {"id": batch_id},
        {"$set": {"status": "QA Hold"}}
    )
    
    if workspace.get("wip_lot_number"):
        await db.stock_snapshots.update_many(
            {"lot_number": workspace["wip_lot_number"]},
            {"$set": {"status": "Quarantine"}}
        )
    
    await broadcast_update("batch.updated", {"batch_code": workspace["batch_code"], "status": "QA Hold"})
    return {"message": "Batch on QA hold", "status": "QA Hold"}

@batching_router.post("/workspace/{batch_id}/release")
async def release_batching(batch_id: str, user: dict = Depends(require_roles(["Admin", "QA"]))):
    """Release a batch from QA hold"""
    workspace = await db.batching_workspace.find_one({"id": batch_id}, {"_id": 0})
    if not workspace:
        raise HTTPException(status_code=404, detail="Batching workspace not found")
    
    await db.batching_workspace.update_one(
        {"id": batch_id},
        {"$set": {"status": "Released"}}
    )
    
    if workspace.get("wip_lot_number"):
        await db.stock_snapshots.update_many(
            {"lot_number": workspace["wip_lot_number"]},
            {"$set": {"status": "Available"}}
        )
    
    await broadcast_update("batch.updated", {"batch_code": workspace["batch_code"], "status": "Released"})
    return {"message": "Batch released", "status": "Released"}

# ============ FORMULAS / BOM ROUTES (PLACEHOLDER) ============

class FormulaCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    product_ids: Optional[List[str]] = []  # A formula can fill into multiple packaged products (e.g. tube + jar)
    category: Optional[str] = ""
    default_batch_size: float = 1.0
    batch_unit: str = "KG"
    recipe_required: bool = False  # When TRUE, batching must match recipe exactly
    variance_tolerance_percent: float = 2.0  # Allowed variance from default qty
    tags: Optional[List[str]] = []
    common_batch_sizes: Optional[List[float]] = []  # Quick-pick sizes shown when starting a new batch

class FormulaLineCreate(BaseModel):
    formula_id: str
    raw_material_id: Optional[str] = None
    raw_material_sku: str
    ingredient_display_name: str  # MUST match Excel "Ingredient Formula" text
    phase: Optional[str] = ""  # A, B, C, D phases
    add_order: int = 0  # Order to add ingredients
    percent: float = 0
    default_qty_required: float = 0  # Default qty for recipe
    uom: str = "KG"
    optional: bool = False
    process_notes: Optional[str] = ""
    batch_notes: Optional[str] = ""

@formulas_router.get("")
async def list_formulas(user: dict = Depends(get_current_user)):
    """List all formulas with recipe_required flag"""
    formulas = await db.formulas.find({}, {"_id": 0}).to_list(1000)
    return formulas

@formulas_router.post("")
async def create_formula(data: FormulaCreate, user: dict = Depends(require_roles(["Admin", "Production"]))):
    """Create a new formula with recipe_required toggle"""
    formula = {
        "id": generate_id(),
        "name": data.name,
        "description": data.description or "",
        "product_ids": data.product_ids or [],
        "category": data.category or "",
        "default_batch_size": data.default_batch_size,
        "batch_unit": data.batch_unit,
        "recipe_required": data.recipe_required,
        "variance_tolerance_percent": data.variance_tolerance_percent,
        "status": "Active",
        "tags": data.tags or [],
        "common_batch_sizes": data.common_batch_sizes or [],
        "created_at": get_timestamp(),
        "created_by": user["id"]
    }
    await db.formulas.insert_one(formula)
    formula.pop("_id", None)
    return formula

@formulas_router.put("/{formula_id}")
async def update_formula(formula_id: str, data: FormulaCreate, user: dict = Depends(require_roles(["Admin"]))):
    """Update a formula including recipe_required toggle"""
    result = await db.formulas.find_one_and_update(
        {"id": formula_id},
        {"$set": {
            "name": data.name,
            "description": data.description,
            "product_ids": data.product_ids or [],
            "category": data.category,
            "default_batch_size": data.default_batch_size,
            "batch_unit": data.batch_unit,
            "recipe_required": data.recipe_required,
            "variance_tolerance_percent": data.variance_tolerance_percent,
            "tags": data.tags,
            "common_batch_sizes": data.common_batch_sizes or []
        }},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Formula not found")
    return {k: v for k, v in result.items() if k != "_id"}

@formulas_router.delete("/{formula_id}")
async def delete_formula(formula_id: str, user: dict = Depends(require_roles(["Admin"]))):
    """Delete a formula and its ingredient lines. Past batches keep their own frozen
    copy of the ingredients and revision code, so deleting a formula doesn't change
    what already-made batches show - it just removes it from being used for new ones."""
    result = await db.formulas.delete_one({"id": formula_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Formula not found")
    await db.formula_lines.delete_many({"formula_id": formula_id})
    await create_audit_log(user["id"], "delete", "formula", formula_id, {})
    return {"message": "Formula deleted"}

@formulas_router.get("/{formula_id}")
async def get_formula(formula_id: str, user: dict = Depends(get_current_user)):
    """Get a formula with its lines"""
    formula = await db.formulas.find_one({"id": formula_id}, {"_id": 0})
    if not formula:
        raise HTTPException(status_code=404, detail="Formula not found")
    
    lines = await db.formula_lines.find({"formula_id": formula_id}, {"_id": 0}).to_list(100)
    formula["lines"] = lines
    return formula

@formulas_router.post("/lines")
async def add_formula_line(data: FormulaLineCreate, user: dict = Depends(require_roles(["Admin", "Production"]))):
    """Add a line to a formula with ingredient_display_name for Excel matching"""
    line = {
        "id": generate_id(),
        "formula_id": data.formula_id,
        "raw_material_id": data.raw_material_id,
        "raw_material_sku": data.raw_material_sku,
        "ingredient_display_name": data.ingredient_display_name,  # Excel matching
        "phase": data.phase or "",
        "add_order": data.add_order,
        "percent": data.percent,
        "default_qty_required": data.default_qty_required,
        "uom": data.uom,
        "optional": data.optional,
        "process_notes": data.process_notes or "",
        "batch_notes": data.batch_notes or "",
        "created_at": get_timestamp()
    }
    await db.formula_lines.insert_one(line)
    line.pop("_id", None)
    return line

@formulas_router.put("/lines/{line_id}")
async def update_formula_line(line_id: str, data: FormulaLineCreate, user: dict = Depends(require_roles(["Admin"]))):
    """Update a formula line"""
    result = await db.formula_lines.find_one_and_update(
        {"id": line_id},
        {"$set": {
            "raw_material_id": data.raw_material_id,
            "raw_material_sku": data.raw_material_sku,
            "ingredient_display_name": data.ingredient_display_name,
            "phase": data.phase,
            "add_order": data.add_order,
            "percent": data.percent,
            "default_qty_required": data.default_qty_required,
            "uom": data.uom,
            "optional": data.optional,
            "process_notes": data.process_notes,
            "batch_notes": data.batch_notes
        }},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Formula line not found")
    return {k: v for k, v in result.items() if k != "_id"}

@formulas_router.delete("/lines/{line_id}")
async def delete_formula_line(line_id: str, user: dict = Depends(require_roles(["Admin"]))):
    """Delete a formula line"""
    result = await db.formula_lines.delete_one({"id": line_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Formula line not found")
    return {"message": "Line deleted"}

@formulas_router.get("/{formula_id}/lines")
async def list_formula_lines(formula_id: str, user: dict = Depends(get_current_user)):
    """List all lines for a formula"""
    lines = await db.formula_lines.find({"formula_id": formula_id}, {"_id": 0}).sort("add_order", 1).to_list(100)
    return lines

# ============ WEBSOCKET ============

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Echo back or handle commands
            if data == "ping":
                await websocket.send_json({"event": "pong", "data": {}})
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# Include routers
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(settings_router)
api_router.include_router(master_router)
api_router.include_router(inventory_router)
api_router.include_router(manufacturing_router)
api_router.include_router(traceability_router)
api_router.include_router(excel_router)
api_router.include_router(batching_router)
api_router.include_router(formulas_router)
api_router.include_router(search_router)
app.include_router(api_router)

# CORS
_cors_origins_env = os.environ.get('CORS_ORIGINS', '')
_cors_origins = [o.strip() for o in _cors_origins_env.split(',') if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
