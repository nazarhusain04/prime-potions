"""
Excel Services for Prime Potions ERP
Handles Excel import/export, batching sheets, and mapping configurations
"""
import io
import uuid
import pandas as pd
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill, Border, Side, Alignment
from openpyxl.utils.dataframe import dataframe_to_rows
from openpyxl.utils import get_column_letter
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import hashlib
import json

# Standard field mappings for Prime Potions Excel files
DEFAULT_RAW_MATERIAL_MAPPINGS = {
    "item_code": ["ITEM CODE", "Item Code", "SKU", "Code", "ItemCode"],
    "name": ["Ingredient Name", "Name", "INCI NAME", "Material Name", "Item Name"],
    "supplier": ["SUPPLIER", "Supplier", "Vendor"],
    "lot_number": ["LOT #", "Lot Number", "LOT", "Lot #", "Lot"],
    "expiry_date": ["EXPIRY / RETEST Date", "Expiry Date", "Expiry", "Retest Date"],
    "manufacturer": ["VENDOR / MANUFACTURER", "Manufacturer", "Vendor / Manufacturer"],
    "inci_name": ["INCI NAME", "INCI", "Scientific Name"],
    "location": ["Primary Inv Zone", "Storage location", "Location", "Zone"],
    "quantity_on_hand": ["Inventory on Hand", "On Hand", "QTY", "Quantity", "Stock"],
    "container_type": ["Container Type", "Container", "Packaging"],
    "uom": ["UoM", "UOM", "Unit", "Unit of Measure"],
    "notes": ["Notes", "Comments", "Remarks"],
    "minimum_stock": ["Safety Stock", "Minimum Stock", "Min Stock", "Reorder Point"],
    "category": ["Class", "Category", "sub category", "Type"],
    "cost_per_unit": ["Cost/unit", "Cost", "Unit Cost", "Price"]
}

DEFAULT_PACKAGING_MAPPINGS = {
    "item_code": ["Item Code", "SKU", "Code"],
    "name": ["Item Name", "Name", "Description"],
    "category": ["category", "Category", "Type"],
    "sub_category": ["sub category", "Sub Category", "Subcategory"],
    "client": ["Client", "Customer"],
    "supplier": ["Supplier", "Vendor"],
    "size_specs": ["Size or Specs", "Size", "Specs", "Specifications"],
    "uom": ["UOM", "UoM", "Unit"],
    "quantity_on_hand": ["On Hand", "Stock", "Quantity"],
    "location": ["Storage location", "Location"],
    "minimum_stock": ["Minimum Stock", "Min Stock"],
    "stock_status": ["Stock Status", "Status"]
}

DEFAULT_BATCHING_MAPPINGS = {
    "ingredient": ["Ingredient", "Material", "Raw Material", "Item"],
    "formula_phase": ["Formula", "Phase", "Process Phase"],
    "inv_location": ["Inv Loc.", "Location", "Storage"],
    "qty_required": ["Qty Required", "Required Qty", "Quantity Required"],
    "add_order": ["Add Order", "Order", "PO Required"],
    "added_kg": ["Added Kg", "Actual Kg", "Qty Added"],
    "sum_total": ["Sum", "Running Total", "Cumulative"],
    "process_notes": ["Process Notes", "Notes", "Instructions"],
    "batch_notes": ["Batch Notes", "Batch Comments"],
    "qty_on_hand": ["Qty on Hand (kg)", "On Hand", "Available"],
    "percent_qty": ["ENTER % QTY HERE", "Percentage", "%", "Pct"]
}


def generate_id():
    return str(uuid.uuid4())


def get_timestamp():
    return datetime.now(timezone.utc).isoformat()


def compute_row_hash(row_data: dict) -> str:
    """Compute hash of row data for change detection"""
    serialized = json.dumps(row_data, sort_keys=True, default=str)
    return hashlib.md5(serialized.encode()).hexdigest()


def fuzzy_match_column(column_name: str, mappings: Dict[str, List[str]]) -> Optional[str]:
    """Find the best matching standard field for a column name"""
    col_lower = column_name.lower().strip()
    
    for standard_field, aliases in mappings.items():
        for alias in aliases:
            if alias.lower() == col_lower:
                return standard_field
    
    # Partial match
    for standard_field, aliases in mappings.items():
        for alias in aliases:
            if alias.lower() in col_lower or col_lower in alias.lower():
                return standard_field
    
    return None


class ExcelService:
    """Service for handling Excel operations"""
    
    @staticmethod
    def analyze_workbook(file_content: bytes) -> Dict[str, Any]:
        """Analyze an Excel workbook and return its structure"""
        wb = load_workbook(io.BytesIO(file_content), data_only=True)
        
        analysis = {
            "sheet_count": len(wb.sheetnames),
            "sheets": []
        }
        
        for sheet_name in wb.sheetnames:
            ws = wb[sheet_name]
            
            # Get headers from first row
            headers = []
            for cell in ws[1]:
                if cell.value:
                    headers.append(str(cell.value))
            
            # Get row count
            row_count = ws.max_row - 1  # Exclude header
            
            # Sample first 5 data rows
            sample_data = []
            for row_idx, row in enumerate(ws.iter_rows(min_row=2, max_row=6, values_only=True), start=1):
                row_dict = {}
                for col_idx, value in enumerate(row):
                    if col_idx < len(headers):
                        row_dict[headers[col_idx]] = value
                sample_data.append(row_dict)
            
            analysis["sheets"].append({
                "name": sheet_name,
                "headers": headers,
                "row_count": row_count,
                "sample_data": sample_data
            })
        
        return analysis
    
    @staticmethod
    def suggest_mappings(headers: List[str], mapping_type: str = "raw_material") -> Dict[str, str]:
        """Suggest field mappings for given headers"""
        if mapping_type == "raw_material":
            mappings = DEFAULT_RAW_MATERIAL_MAPPINGS
        elif mapping_type == "packaging":
            mappings = DEFAULT_PACKAGING_MAPPINGS
        elif mapping_type == "batching":
            mappings = DEFAULT_BATCHING_MAPPINGS
        else:
            mappings = DEFAULT_RAW_MATERIAL_MAPPINGS
        
        suggestions = {}
        for header in headers:
            match = fuzzy_match_column(header, mappings)
            if match:
                suggestions[header] = match
            else:
                suggestions[header] = None  # No match found
        
        return suggestions
    
    @staticmethod
    def parse_excel_to_records(
        file_content: bytes,
        sheet_name: str,
        field_mappings: Dict[str, str]
    ) -> List[Dict[str, Any]]:
        """Parse Excel sheet to list of records using field mappings"""
        wb = load_workbook(io.BytesIO(file_content), data_only=True)
        ws = wb[sheet_name]
        
        # Get headers
        headers = [str(cell.value) if cell.value else f"col_{i}" for i, cell in enumerate(ws[1])]
        
        records = []
        for row in ws.iter_rows(min_row=2, values_only=True):
            record = {"_raw": {}}
            for col_idx, value in enumerate(row):
                if col_idx < len(headers):
                    original_header = headers[col_idx]
                    record["_raw"][original_header] = value
                    
                    # Map to standard field
                    if original_header in field_mappings and field_mappings[original_header]:
                        standard_field = field_mappings[original_header]
                        record[standard_field] = value
            
            # Only add non-empty records
            if any(v for k, v in record.items() if k != "_raw" and v is not None):
                records.append(record)
        
        return records
    
    @staticmethod
    def generate_batching_template(
        batch_info: Dict[str, Any],
        ingredients: List[Dict[str, Any]],
        inventory_snapshot: List[Dict[str, Any]]
    ) -> bytes:
        """Generate a batching Excel template with inventory snapshot"""
        wb = Workbook()
        
        # Styles
        header_font = Font(bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="0F5132", end_color="0F5132", fill_type="solid")
        thin_border = Border(
            left=Side(style='thin'),
            right=Side(style='thin'),
            top=Side(style='thin'),
            bottom=Side(style='thin')
        )
        
        # ============ README Sheet ============
        ws_readme = wb.active
        ws_readme.title = "README_Batching"
        readme_content = [
            ["PRIME POTIONS BATCHING SHEET"],
            [""],
            ["Instructions:"],
            ["1. Review the BatchHeader sheet and update batch information"],
            ["2. In BatchIngredients, enter ACTUAL quantities used in 'actual_qty' column"],
            ["3. Assign lot codes used in 'lot_code_used' column (or use LotSplit sheet for multiple lots)"],
            ["4. InventorySnapshot is read-only - shows current available inventory"],
            ["5. Upload this completed file to ERP to record batch consumption"],
            [""],
            ["Generated:", get_timestamp()],
            ["Batch ID:", batch_info.get("batch_id", "")],
            ["Batch Code:", batch_info.get("batch_code", "")]
        ]
        for row in readme_content:
            ws_readme.append(row)
        ws_readme["A1"].font = Font(bold=True, size=16)
        
        # ============ BatchHeader Sheet ============
        ws_header = wb.create_sheet("BatchHeader")
        header_fields = [
            ("batch_id", batch_info.get("batch_id", generate_id())),
            ("batch_code", batch_info.get("batch_code", "")),
            ("product_or_formula_name", batch_info.get("formula_name", "")),
            ("planned_batch_size", batch_info.get("planned_qty", 0)),
            ("actual_batch_size", ""),  # To be filled
            ("batch_size_unit", batch_info.get("batch_unit", "KG")),
            ("planned_start_date", batch_info.get("planned_start", "")),
            ("actual_end_date", ""),  # To be filled
            ("status", "Planned"),
            ("notes", batch_info.get("notes", ""))
        ]
        
        ws_header.append(["Field", "Value"])
        ws_header["A1"].font = header_font
        ws_header["A1"].fill = header_fill
        ws_header["B1"].font = header_font
        ws_header["B1"].fill = header_fill
        
        for field, value in header_fields:
            ws_header.append([field, value])
        
        ws_header.column_dimensions["A"].width = 25
        ws_header.column_dimensions["B"].width = 40
        
        # ============ BatchIngredients Sheet ============
        ws_ingredients = wb.create_sheet("BatchIngredients")
        ingredient_headers = [
            "row_id", "batch_id", "raw_material_sku", "raw_material_name", 
            "uom", "formula_phase", "formula_percent", "planned_qty", "actual_qty", 
            "variance_qty", "lot_code_used", "process_notes"
        ]
        
        ws_ingredients.append(ingredient_headers)
        for col_idx, header in enumerate(ingredient_headers, 1):
            cell = ws_ingredients.cell(row=1, column=col_idx)
            cell.font = header_font
            cell.fill = header_fill
            cell.border = thin_border
        
        for ing in ingredients:
            row_id = generate_id()
            ws_ingredients.append([
                row_id,
                batch_info.get("batch_id", ""),
                ing.get("sku", ""),
                ing.get("name", ""),
                ing.get("uom", "KG"),
                ing.get("phase", ""),
                ing.get("percent", 0),
                ing.get("planned_qty", 0),
                "",  # actual_qty - to be filled
                f"=I{ws_ingredients.max_row + 1}-H{ws_ingredients.max_row + 1}",  # variance formula
                "",  # lot_code_used - to be filled
                ing.get("notes", "")
            ])
        
        # Auto-width columns
        for col_idx, header in enumerate(ingredient_headers, 1):
            ws_ingredients.column_dimensions[get_column_letter(col_idx)].width = max(15, len(header) + 2)
        
        # ============ LotSplit Sheet ============
        ws_lotsplit = wb.create_sheet("LotSplit")
        lotsplit_headers = ["split_id", "batch_id", "raw_material_sku", "lot_code", "qty_used"]
        
        ws_lotsplit.append(lotsplit_headers)
        for col_idx, header in enumerate(lotsplit_headers, 1):
            cell = ws_lotsplit.cell(row=1, column=col_idx)
            cell.font = header_font
            cell.fill = header_fill
            cell.border = thin_border
        
        for col_idx, header in enumerate(lotsplit_headers, 1):
            ws_lotsplit.column_dimensions[get_column_letter(col_idx)].width = 20
        
        # ============ InventorySnapshot Sheet ============
        ws_inventory = wb.create_sheet("InventorySnapshot")
        inventory_headers = ["sku", "name", "lot_code", "location", "available_qty", "uom", "status", "expiry_date"]
        
        ws_inventory.append(inventory_headers)
        for col_idx, header in enumerate(inventory_headers, 1):
            cell = ws_inventory.cell(row=1, column=col_idx)
            cell.font = header_font
            cell.fill = PatternFill(start_color="334155", end_color="334155", fill_type="solid")
            cell.border = thin_border
        
        for item in inventory_snapshot:
            ws_inventory.append([
                item.get("sku", ""),
                item.get("name", ""),
                item.get("lot_number", ""),
                item.get("location", ""),
                item.get("quantity_available", 0),
                item.get("uom", ""),
                item.get("status", ""),
                item.get("expiry_date", "")
            ])
        
        for col_idx, header in enumerate(inventory_headers, 1):
            ws_inventory.column_dimensions[get_column_letter(col_idx)].width = max(15, len(header) + 2)
        
        # Protect InventorySnapshot sheet (read-only)
        ws_inventory.protection.sheet = True
        
        # Save to bytes
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return output.getvalue()
    
    @staticmethod
    def parse_batching_sheet(file_content: bytes) -> Dict[str, Any]:
        """Parse a completed batching sheet upload"""
        wb = load_workbook(io.BytesIO(file_content), data_only=True)
        
        result = {
            "batch_header": {},
            "ingredients": [],
            "lot_splits": [],
            "validation_errors": [],
            "warnings": []
        }
        
        # Parse BatchHeader
        if "BatchHeader" in wb.sheetnames:
            ws = wb["BatchHeader"]
            for row in ws.iter_rows(min_row=2, values_only=True):
                if row[0] and row[1] is not None:
                    result["batch_header"][row[0]] = row[1]
        
        # Parse BatchIngredients
        if "BatchIngredients" in wb.sheetnames:
            ws = wb["BatchIngredients"]
            headers = [str(cell.value) if cell.value else f"col_{i}" for i, cell in enumerate(ws[1])]
            
            for row in ws.iter_rows(min_row=2, values_only=True):
                ing = {}
                for col_idx, value in enumerate(row):
                    if col_idx < len(headers):
                        ing[headers[col_idx]] = value
                
                if ing.get("raw_material_sku"):
                    # Validate required fields
                    if ing.get("actual_qty") is None:
                        result["warnings"].append(f"Missing actual_qty for {ing.get('raw_material_name', 'unknown')}")
                    if not ing.get("lot_code_used"):
                        result["warnings"].append(f"Missing lot_code for {ing.get('raw_material_name', 'unknown')}")
                    
                    result["ingredients"].append(ing)
        
        # Parse LotSplit
        if "LotSplit" in wb.sheetnames:
            ws = wb["LotSplit"]
            headers = [str(cell.value) if cell.value else f"col_{i}" for i, cell in enumerate(ws[1])]
            
            for row in ws.iter_rows(min_row=2, values_only=True):
                split = {}
                for col_idx, value in enumerate(row):
                    if col_idx < len(headers):
                        split[headers[col_idx]] = value
                
                if split.get("lot_code") and split.get("qty_used"):
                    result["lot_splits"].append(split)
        
        return result
    
    @staticmethod
    def generate_master_data_template(template_type: str) -> bytes:
        """Generate a template for master data import"""
        wb = Workbook()
        ws = wb.active
        
        header_font = Font(bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="0F5132", end_color="0F5132", fill_type="solid")
        
        if template_type == "raw_materials":
            ws.title = "RawMaterials"
            headers = ["item_code", "name", "inci_name", "supplier", "manufacturer", 
                      "uom", "category", "location", "minimum_stock", "cost_per_unit", "notes"]
            example = ["RM-001", "Aloe Vera Extract", "Aloe Barbadensis Leaf Juice", 
                      "Supplier Co", "Manufacturer Inc", "KG", "Active", "9C", "10", "25.50", "Organic certified"]
        elif template_type == "packaging":
            ws.title = "PackagingMaterials"
            headers = ["item_code", "name", "category", "sub_category", "client",
                      "supplier", "size_specs", "uom", "location", "minimum_stock"]
            example = ["PKG-001", "100ml Amber Bottle", "Bottle packaging", "Bottles",
                      "PAUME", "Supplier Co", "100ml", "EA", "WH-01", "1000"]
        elif template_type == "inventory_receipt":
            ws.title = "InventoryReceipt"
            headers = ["item_code", "item_type", "quantity", "lot_number", "location", "expiry_date", "notes"]
            example = ["RM-001", "raw_material", "100", "", "WH-01", "2026-12-31", "Initial receipt"]
        else:
            ws.title = "Items"
            headers = ["item_code", "name", "category", "uom", "notes"]
            example = ["ITEM-001", "Example Item", "General", "EA", "Example notes"]
        
        ws.append(headers)
        for col_idx, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col_idx)
            cell.font = header_font
            cell.fill = header_fill
        
        ws.append(example)
        
        # Auto-width
        for col_idx, header in enumerate(headers, 1):
            ws.column_dimensions[get_column_letter(col_idx)].width = max(15, len(header) + 5)
        
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return output.getvalue()


class ImportPreviewService:
    """Service for generating import previews with diff detection"""
    
    @staticmethod
    async def generate_preview(
        records: List[Dict[str, Any]],
        existing_items: Dict[str, Dict[str, Any]],
        key_field: str = "item_code"
    ) -> Dict[str, Any]:
        """Generate a preview of changes that would be made by import"""
        preview = {
            "create": [],
            "update": [],
            "unchanged": [],
            "errors": [],
            "summary": {
                "total_records": len(records),
                "to_create": 0,
                "to_update": 0,
                "unchanged": 0,
                "errors": 0
            }
        }
        
        for record in records:
            key = record.get(key_field)
            
            if not key:
                preview["errors"].append({
                    "record": record,
                    "error": f"Missing required field: {key_field}"
                })
                preview["summary"]["errors"] += 1
                continue
            
            if key in existing_items:
                existing = existing_items[key]
                # Check for changes
                changes = {}
                for field, new_value in record.items():
                    if field.startswith("_"):
                        continue
                    old_value = existing.get(field)
                    if old_value != new_value and new_value is not None:
                        changes[field] = {"old": old_value, "new": new_value}
                
                if changes:
                    preview["update"].append({
                        "key": key,
                        "changes": changes,
                        "record": record
                    })
                    preview["summary"]["to_update"] += 1
                else:
                    preview["unchanged"].append(key)
                    preview["summary"]["unchanged"] += 1
            else:
                preview["create"].append({
                    "key": key,
                    "record": record
                })
                preview["summary"]["to_create"] += 1
        
        return preview
