"""
Test P0 and P1 Features for Prime Potions ERP
- P0: Inventory On-Hand visibility, searchable dropdowns, expanded UOM
- P1: Excel template matching with Prime Potions exact headers, Recipe Required toggle for formulas
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@primepotions.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        return data["access_token"]
    
    def test_login_success(self):
        """Test login with admin credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@primepotions.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["role"] == "Admin"
        assert data["user"]["email"] == "admin@primepotions.com"


class TestInventoryOnHand:
    """P0: Inventory On-Hand visibility tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@primepotions.com",
            "password": "admin123"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_inventory_onhand_endpoint(self, auth_headers):
        """Test /api/inventory/onhand endpoint returns proper structure"""
        response = requests.get(f"{BASE_URL}/api/inventory/onhand", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "skip" in data
        assert "limit" in data
        print(f"Inventory on-hand: {data['total']} items")
    
    def test_inventory_onhand_with_filters(self, auth_headers):
        """Test inventory on-hand with search and type filters"""
        # Test with search filter
        response = requests.get(f"{BASE_URL}/api/inventory/onhand?search=test", headers=auth_headers)
        assert response.status_code == 200
        
        # Test with type filter
        response = requests.get(f"{BASE_URL}/api/inventory/onhand?item_type=RAW", headers=auth_headers)
        assert response.status_code == 200
        
        # Test with below_min_only filter
        response = requests.get(f"{BASE_URL}/api/inventory/onhand?below_min_only=true", headers=auth_headers)
        assert response.status_code == 200
    
    def test_low_stock_alerts_endpoint(self, auth_headers):
        """Test /api/inventory/alerts/low-stock endpoint"""
        response = requests.get(f"{BASE_URL}/api/inventory/alerts/low-stock", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "alerts" in data
        assert "count" in data
        print(f"Low stock alerts: {data['count']} items")


class TestSearchEndpoints:
    """P0: Searchable dropdowns tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@primepotions.com",
            "password": "admin123"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_search_items_endpoint(self, auth_headers):
        """Test /api/search/items endpoint for searchable dropdowns"""
        response = requests.get(f"{BASE_URL}/api/search/items", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "count" in data
        print(f"Search items: {data['count']} items found")
    
    def test_search_items_with_query(self, auth_headers):
        """Test search items with query parameter"""
        response = requests.get(f"{BASE_URL}/api/search/items?q=test", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
    
    def test_search_items_with_type_filter(self, auth_headers):
        """Test search items with type filter"""
        response = requests.get(f"{BASE_URL}/api/search/items?type=RAW", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
    
    def test_search_locations_endpoint(self, auth_headers):
        """Test /api/search/locations endpoint"""
        response = requests.get(f"{BASE_URL}/api/search/locations", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "locations" in data
        assert "count" in data
        print(f"Search locations: {data['count']} locations found")
    
    def test_search_formulas_endpoint(self, auth_headers):
        """Test /api/search/formulas endpoint"""
        response = requests.get(f"{BASE_URL}/api/search/formulas", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "formulas" in data
        assert "count" in data
        print(f"Search formulas: {data['count']} formulas found")
    
    def test_search_lots_endpoint(self, auth_headers):
        """Test /api/search/lots endpoint"""
        response = requests.get(f"{BASE_URL}/api/search/lots", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "lots" in data
        assert "count" in data
    
    def test_search_categories_endpoint(self, auth_headers):
        """Test /api/search/categories endpoint"""
        response = requests.get(f"{BASE_URL}/api/search/categories", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "categories" in data


class TestExpandedUOM:
    """P0: Expanded UOM support tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@primepotions.com",
            "password": "admin123"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_uom_endpoint_returns_expanded_units(self, auth_headers):
        """Test /api/master/uom returns expanded units including oz/fl oz"""
        response = requests.get(f"{BASE_URL}/api/master/uom", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "uoms" in data
        
        uom_codes = [u["code"] for u in data["uoms"]]
        
        # Check for expanded UOM support
        assert "KG" in uom_codes, "KG should be in UOM list"
        assert "G" in uom_codes, "G should be in UOM list"
        assert "L" in uom_codes, "L should be in UOM list"
        assert "ML" in uom_codes, "ML should be in UOM list"
        assert "OZ" in uom_codes, "OZ (ounce weight) should be in UOM list"
        assert "FL_OZ" in uom_codes, "FL_OZ (fluid ounce) should be in UOM list"
        assert "EA" in uom_codes, "EA should be in UOM list"
        assert "LB" in uom_codes, "LB should be in UOM list"
        
        print(f"UOM list contains {len(data['uoms'])} units: {uom_codes}")
    
    def test_uom_resolve_endpoint(self, auth_headers):
        """Test /api/master/uom/resolve/{uom_text} endpoint"""
        # Test resolving OZ
        response = requests.get(f"{BASE_URL}/api/master/uom/resolve/oz", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "resolved" in data
        
        # Test resolving FL_OZ
        response = requests.get(f"{BASE_URL}/api/master/uom/resolve/fl oz", headers=auth_headers)
        assert response.status_code == 200


class TestExcelExport:
    """P1: Excel template matching tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@primepotions.com",
            "password": "admin123"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_export_raw_materials_excel(self, auth_headers):
        """Test /api/excel/prime-potions/raw-materials export"""
        response = requests.get(f"{BASE_URL}/api/excel/prime-potions/raw-materials", headers=auth_headers)
        assert response.status_code == 200
        assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in response.headers.get("content-type", "")
        assert len(response.content) > 0
        print(f"Raw materials Excel export: {len(response.content)} bytes")
    
    def test_export_packaging_excel(self, auth_headers):
        """Test /api/excel/prime-potions/packaging export"""
        response = requests.get(f"{BASE_URL}/api/excel/prime-potions/packaging", headers=auth_headers)
        assert response.status_code == 200
        assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in response.headers.get("content-type", "")
        assert len(response.content) > 0
        print(f"Packaging Excel export: {len(response.content)} bytes")
    
    def test_export_batching_template_excel(self, auth_headers):
        """Test /api/excel/prime-potions/batching-template export"""
        response = requests.get(f"{BASE_URL}/api/excel/prime-potions/batching-template", headers=auth_headers)
        assert response.status_code == 200
        assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in response.headers.get("content-type", "")
        assert len(response.content) > 0
        print(f"Batching template Excel export: {len(response.content)} bytes")


class TestFormulasWithRecipeRequired:
    """P1: Recipe Required toggle for formulas tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@primepotions.com",
            "password": "admin123"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_list_formulas(self, auth_headers):
        """Test /api/formulas endpoint"""
        response = requests.get(f"{BASE_URL}/api/formulas", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Formulas: {len(data)} formulas found")
    
    def test_create_formula_with_recipe_required_false(self, auth_headers):
        """Test creating formula with recipe_required=false (flexible mode)"""
        formula_data = {
            "name": "TEST_Flexible_Formula",
            "description": "Test formula without strict recipe",
            "category": "Test",
            "default_batch_size": 10.0,
            "batch_unit": "KG",
            "recipe_required": False,
            "variance_tolerance_percent": 5.0,
            "tags": ["test"]
        }
        response = requests.post(f"{BASE_URL}/api/formulas", json=formula_data, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "TEST_Flexible_Formula"
        assert data["recipe_required"] == False
        assert "id" in data
        print(f"Created flexible formula: {data['id']}")
        return data["id"]
    
    def test_create_formula_with_recipe_required_true(self, auth_headers):
        """Test creating formula with recipe_required=true (strict mode)"""
        formula_data = {
            "name": "TEST_Strict_Formula",
            "description": "Test formula with strict recipe enforcement",
            "category": "Test",
            "default_batch_size": 5.0,
            "batch_unit": "KG",
            "recipe_required": True,
            "variance_tolerance_percent": 2.0,
            "tags": ["test", "strict"]
        }
        response = requests.post(f"{BASE_URL}/api/formulas", json=formula_data, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "TEST_Strict_Formula"
        assert data["recipe_required"] == True
        assert data["variance_tolerance_percent"] == 2.0
        assert "id" in data
        print(f"Created strict formula: {data['id']}")
        return data["id"]
    
    def test_get_formula_by_id(self, auth_headers):
        """Test getting a specific formula"""
        # First create a formula
        formula_data = {
            "name": "TEST_Get_Formula",
            "recipe_required": True,
            "variance_tolerance_percent": 3.0
        }
        create_response = requests.post(f"{BASE_URL}/api/formulas", json=formula_data, headers=auth_headers)
        assert create_response.status_code == 200
        formula_id = create_response.json()["id"]
        
        # Then get it
        response = requests.get(f"{BASE_URL}/api/formulas/{formula_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == formula_id
        assert data["recipe_required"] == True
    
    def test_update_formula_recipe_required(self, auth_headers):
        """Test updating formula recipe_required toggle"""
        # Create formula
        formula_data = {
            "name": "TEST_Update_Formula",
            "recipe_required": False
        }
        create_response = requests.post(f"{BASE_URL}/api/formulas", json=formula_data, headers=auth_headers)
        assert create_response.status_code == 200
        formula_id = create_response.json()["id"]
        
        # Update to strict mode
        update_data = {
            "name": "TEST_Update_Formula",
            "recipe_required": True,
            "variance_tolerance_percent": 1.5
        }
        response = requests.put(f"{BASE_URL}/api/formulas/{formula_id}", json=update_data, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["recipe_required"] == True
        assert data["variance_tolerance_percent"] == 1.5
    
    def test_formula_lines_crud(self, auth_headers):
        """Test formula lines CRUD operations"""
        # Create formula
        formula_data = {
            "name": "TEST_Formula_Lines",
            "recipe_required": True
        }
        create_response = requests.post(f"{BASE_URL}/api/formulas", json=formula_data, headers=auth_headers)
        assert create_response.status_code == 200
        formula_id = create_response.json()["id"]
        
        # Add line
        line_data = {
            "formula_id": formula_id,
            "raw_material_sku": "TEST-SKU-001",
            "ingredient_display_name": "Test Ingredient",
            "phase": "A",
            "add_order": 1,
            "default_qty_required": 5.0,
            "uom": "KG"
        }
        line_response = requests.post(f"{BASE_URL}/api/formulas/lines", json=line_data, headers=auth_headers)
        assert line_response.status_code == 200
        line_id = line_response.json()["id"]
        
        # Get lines
        lines_response = requests.get(f"{BASE_URL}/api/formulas/{formula_id}/lines", headers=auth_headers)
        assert lines_response.status_code == 200
        lines = lines_response.json()
        assert len(lines) >= 1
        
        # Delete line
        delete_response = requests.delete(f"{BASE_URL}/api/formulas/lines/{line_id}", headers=auth_headers)
        assert delete_response.status_code == 200


class TestMasterDataEndpoints:
    """Additional master data endpoint tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@primepotions.com",
            "password": "admin123"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_list_raw_materials(self, auth_headers):
        """Test /api/master/raw-materials endpoint"""
        response = requests.get(f"{BASE_URL}/api/master/raw-materials", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Raw materials: {len(data)} items")
    
    def test_list_packaging_materials(self, auth_headers):
        """Test /api/master/packaging-materials endpoint"""
        response = requests.get(f"{BASE_URL}/api/master/packaging-materials", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Packaging materials: {len(data)} items")
    
    def test_list_products(self, auth_headers):
        """Test /api/master/products endpoint"""
        response = requests.get(f"{BASE_URL}/api/master/products", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Products: {len(data)} items")
    
    def test_list_locations(self, auth_headers):
        """Test /api/master/locations endpoint"""
        response = requests.get(f"{BASE_URL}/api/master/locations", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Locations: {len(data)} items")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
