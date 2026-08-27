"""
Prime Potions ERP Backend API Tests
Tests for: Auth, Batching Workspace, Dashboard, Master Data
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8000')

# Test credentials
ADMIN_EMAIL = "admin@primepotions.com"
ADMIN_PASSWORD = "admin123"


class TestAuth:
    """Authentication endpoint tests"""
    
    def test_login_success(self):
        """Test successful login with admin credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert "user" in data, "No user in response"
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "Admin"
        assert data["token_type"] == "bearer"
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401
        
    def test_get_me_authenticated(self, auth_token):
        """Test getting current user info"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] == "Admin"
    
    def test_get_me_unauthenticated(self):
        """Test getting current user without auth"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code in [401, 403]


class TestBatchingWorkspace:
    """Batching Workspace endpoint tests"""
    
    def test_list_workspaces(self, auth_token):
        """Test listing batching workspaces"""
        response = requests.get(
            f"{BASE_URL}/api/batching/workspace",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_create_workspace(self, auth_token, test_location_id):
        """Test creating a new batching workspace"""
        workspace_data = {
            "formula_id": "",
            "formula_name": "TEST_Batch_Product",
            "planned_qty": 100.0,
            "batch_unit": "KG",
            "target_location_id": test_location_id,
            "notes": "Test workspace creation"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/batching/workspace",
            headers={"Authorization": f"Bearer {auth_token}"},
            json=workspace_data
        )
        assert response.status_code == 200, f"Create workspace failed: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert "batch_code" in data
        assert data["formula_name"] == "TEST_Batch_Product"
        assert data["planned_qty"] == 100.0
        assert data["status"] == "Planned"
        
        return data["id"]
    
    def test_start_workspace(self, auth_token, test_location_id):
        """Test starting a batching workspace"""
        # First create a workspace
        workspace_data = {
            "formula_id": "",
            "formula_name": "TEST_Start_Batch",
            "planned_qty": 50.0,
            "batch_unit": "KG",
            "target_location_id": test_location_id,
            "notes": "Test start batch"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/batching/workspace",
            headers={"Authorization": f"Bearer {auth_token}"},
            json=workspace_data
        )
        assert create_response.status_code == 200
        workspace_id = create_response.json()["id"]
        
        # Start the workspace
        start_response = requests.post(
            f"{BASE_URL}/api/batching/workspace/{workspace_id}/start",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert start_response.status_code == 200, f"Start failed: {start_response.text}"
        
        data = start_response.json()
        assert data["status"] == "In Progress"
    
    def test_download_sheet(self, auth_token, test_location_id):
        """Test downloading batching sheet"""
        # Create a workspace first
        workspace_data = {
            "formula_id": "",
            "formula_name": "TEST_Download_Sheet",
            "planned_qty": 75.0,
            "batch_unit": "KG",
            "target_location_id": test_location_id,
            "notes": "Test download"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/batching/workspace",
            headers={"Authorization": f"Bearer {auth_token}"},
            json=workspace_data
        )
        assert create_response.status_code == 200
        workspace_id = create_response.json()["id"]
        
        # Download sheet
        download_response = requests.get(
            f"{BASE_URL}/api/batching/workspace/{workspace_id}/download-sheet",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert download_response.status_code == 200
        assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in download_response.headers.get("content-type", "")


class TestDashboard:
    """Dashboard endpoint tests"""
    
    def test_dashboard_summary(self, auth_token):
        """Test getting dashboard summary"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/summary",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "raw_materials" in data
        assert "packaging_materials" in data
        assert "wip_batches" in data
        assert "finished_goods" in data
        assert "active_batch_orders" in data
        assert "active_filling_orders" in data
    
    def test_dashboard_unauthenticated(self):
        """Test dashboard without auth"""
        response = requests.get(f"{BASE_URL}/api/dashboard/summary")
        assert response.status_code in [401, 403]


class TestMasterData:
    """Master Data endpoint tests"""
    
    def test_list_locations(self, auth_token):
        """Test listing locations"""
        response = requests.get(
            f"{BASE_URL}/api/master/locations",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0, "No locations found - seed data may be missing"
        
        # Verify location structure
        location = data[0]
        assert "id" in location
        assert "code" in location
        assert "name" in location
        assert "type" in location
    
    def test_list_raw_materials(self, auth_token):
        """Test listing raw materials"""
        response = requests.get(
            f"{BASE_URL}/api/master/raw-materials",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_list_packaging_materials(self, auth_token):
        """Test listing packaging materials"""
        response = requests.get(
            f"{BASE_URL}/api/master/packaging-materials",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_list_products(self, auth_token):
        """Test listing products"""
        response = requests.get(
            f"{BASE_URL}/api/master/products",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_list_units(self, auth_token):
        """Test listing units of measure"""
        response = requests.get(
            f"{BASE_URL}/api/master/units",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestFormulas:
    """Formulas/BOM endpoint tests"""
    
    def test_list_formulas(self, auth_token):
        """Test listing formulas"""
        response = requests.get(
            f"{BASE_URL}/api/formulas",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestInventory:
    """Inventory endpoint tests"""
    
    def test_get_stock(self, auth_token):
        """Test getting stock"""
        response = requests.get(
            f"{BASE_URL}/api/inventory/stock",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_stock_summary(self, auth_token):
        """Test getting stock summary"""
        response = requests.get(
            f"{BASE_URL}/api/inventory/stock/summary",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)


class TestManufacturing:
    """Manufacturing endpoint tests"""
    
    def test_list_batch_orders(self, auth_token):
        """Test listing batch orders"""
        response = requests.get(
            f"{BASE_URL}/api/manufacturing/batch-orders",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_list_filling_orders(self, auth_token):
        """Test listing filling orders"""
        response = requests.get(
            f"{BASE_URL}/api/manufacturing/filling-orders",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_wip_on_floor(self, auth_token):
        """Test getting WIP on floor"""
        response = requests.get(
            f"{BASE_URL}/api/manufacturing/wip-on-floor",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_lots" in data
        assert "by_status" in data


# ============ FIXTURES ============

@pytest.fixture(scope="session")
def auth_token():
    """Get authentication token for tests"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Authentication failed: {response.text}")
    return response.json()["access_token"]


@pytest.fixture(scope="session")
def test_location_id(auth_token):
    """Get a location ID for tests"""
    response = requests.get(
        f"{BASE_URL}/api/master/locations",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    if response.status_code != 200 or not response.json():
        pytest.skip("No locations available for testing")
    return response.json()[0]["id"]
