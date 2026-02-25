"""
Test P2 Features for Prime Potions ERP
- Batching import with strict/flexible recipe validation
- Import Wizard endpoints (analyze, preview, apply)
- Enhanced Traceability views (forward, backward, where-used)
"""
import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication tests for P2"""
    
    def test_login_admin(self):
        """Test login with admin credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@primepotions.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "Admin"
        print(f"Login successful: {data['user']['email']}")


class TestBatchingImport:
    """P2: Batching import with strict/flexible validation"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@primepotions.com",
            "password": "admin123"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_batching_import_endpoint_exists(self, auth_headers):
        """Test that batching import endpoint exists"""
        # Test with empty file - should return 422 (validation error) not 404
        response = requests.post(
            f"{BASE_URL}/api/excel/prime-potions/import-batching",
            headers=auth_headers,
            files={}
        )
        # 422 means endpoint exists but validation failed (no file)
        assert response.status_code in [400, 422], f"Unexpected status: {response.status_code}"
        print(f"Batching import endpoint exists, status: {response.status_code}")
    
    def test_batching_import_with_test_file(self, auth_headers):
        """Test batching import with test Excel file"""
        test_file_path = "/tmp/test_batch_upload.xlsx"
        
        # Check if test file exists
        if not os.path.exists(test_file_path):
            pytest.skip("Test file not found at /tmp/test_batch_upload.xlsx")
        
        with open(test_file_path, "rb") as f:
            response = requests.post(
                f"{BASE_URL}/api/excel/prime-potions/import-batching",
                headers=auth_headers,
                files={"file": ("test_batch.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            )
        
        # Should return 200 or 400 (validation errors), not 500
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}, response: {response.text[:500]}"
        
        if response.status_code == 200:
            data = response.json()
            assert "mode" in data, "Response should contain mode (STRICT/FLEXIBLE)"
            assert "validation" in data, "Response should contain validation results"
            print(f"Batching import result: mode={data.get('mode')}, validation passed={data.get('validation', {}).get('passed')}")
        else:
            print(f"Batching import validation failed: {response.text[:300]}")


class TestImportWizard:
    """P2: Import Wizard endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@primepotions.com",
            "password": "admin123"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_import_wizard_analyze_endpoint_exists(self, auth_headers):
        """Test that import wizard analyze endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/excel/import-wizard/analyze",
            headers=auth_headers,
            files={}
        )
        # 422 means endpoint exists but validation failed (no file)
        assert response.status_code in [400, 422], f"Unexpected status: {response.status_code}"
        print(f"Import wizard analyze endpoint exists, status: {response.status_code}")
    
    def test_import_wizard_analyze_with_file(self, auth_headers):
        """Test import wizard analyze with test file"""
        test_file_path = "/tmp/test_batch_upload.xlsx"
        
        if not os.path.exists(test_file_path):
            pytest.skip("Test file not found")
        
        with open(test_file_path, "rb") as f:
            response = requests.post(
                f"{BASE_URL}/api/excel/import-wizard/analyze",
                headers=auth_headers,
                files={"file": ("test.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            )
        
        assert response.status_code == 200, f"Analyze failed: {response.text[:500]}"
        data = response.json()
        
        assert "analysis" in data, "Response should contain analysis"
        assert "sheets" in data.get("analysis", {}), "Analysis should contain sheets"
        
        print(f"Import wizard analyze: {data.get('total_sheets', 0)} sheets found")
        for sheet in data.get("analysis", {}).get("sheets", []):
            print(f"  - Sheet: {sheet.get('name')}, rows: {sheet.get('row_count')}, suggested_type: {sheet.get('suggested_type')}")
    
    def test_import_wizard_preview_endpoint_exists(self, auth_headers):
        """Test that import wizard preview endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/excel/import-wizard/preview",
            headers=auth_headers,
            params={"sheet_name": "Sheet1", "data_type": "raw_materials", "field_mappings": "{}"},
            files={}
        )
        # 422 means endpoint exists but validation failed
        assert response.status_code in [400, 422], f"Unexpected status: {response.status_code}"
        print(f"Import wizard preview endpoint exists, status: {response.status_code}")
    
    def test_import_wizard_apply_endpoint_exists(self, auth_headers):
        """Test that import wizard apply endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/excel/import-wizard/apply",
            headers=auth_headers,
            params={"sheet_name": "Sheet1", "data_type": "raw_materials", "field_mappings": "{}"},
            files={}
        )
        # 422 means endpoint exists but validation failed
        assert response.status_code in [400, 422], f"Unexpected status: {response.status_code}"
        print(f"Import wizard apply endpoint exists, status: {response.status_code}")


class TestTraceability:
    """P2: Enhanced Traceability endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@primepotions.com",
            "password": "admin123"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_traceability_forward_endpoint(self, auth_headers):
        """Test forward traceability endpoint"""
        # Test with a sample lot number
        response = requests.get(
            f"{BASE_URL}/api/traceability/forward/TEST-LOT-001",
            headers=auth_headers
        )
        # Should return 200 (empty result) or 404 (lot not found)
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert "source_lot" in data, "Response should contain source_lot"
            assert "batches" in data, "Response should contain batches"
            print(f"Forward trace: {len(data.get('batches', []))} batches found")
        else:
            print("Forward trace: lot not found (expected for test lot)")
    
    def test_traceability_backward_endpoint(self, auth_headers):
        """Test backward traceability endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/traceability/backward/TEST-LOT-001",
            headers=auth_headers
        )
        # Should return 200 or 404
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert "lot_number" in data, "Response should contain lot_number"
            print(f"Backward trace: lot_type={data.get('lot_type')}")
        else:
            print("Backward trace: lot not found (expected for test lot)")
    
    def test_traceability_where_used_endpoint(self, auth_headers):
        """Test where-used traceability endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/traceability/where-used/test-item-id",
            headers=auth_headers,
            params={"item_type": "raw_material"}
        )
        # Should return 200
        assert response.status_code == 200, f"Unexpected status: {response.status_code}, response: {response.text}"
        
        data = response.json()
        assert "item_id" in data, "Response should contain item_id"
        assert "used_in_batches" in data, "Response should contain used_in_batches"
        print(f"Where-used: {len(data.get('used_in_batches', []))} batches, {len(data.get('used_in_filling', []))} filling orders")


class TestDashboard:
    """Test Dashboard with WebSocket subscription"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@primepotions.com",
            "password": "admin123"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_dashboard_summary_endpoint(self, auth_headers):
        """Test dashboard summary endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/summary",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Dashboard summary failed: {response.text}"
        data = response.json()
        print(f"Dashboard summary: {data}")
    
    def test_wip_on_floor_endpoint(self, auth_headers):
        """Test WIP on floor endpoint (used by dashboard)"""
        response = requests.get(
            f"{BASE_URL}/api/manufacturing/wip-on-floor",
            headers=auth_headers
        )
        assert response.status_code == 200, f"WIP on floor failed: {response.text}"
        data = response.json()
        print(f"WIP on floor: {len(data.get('wip_batches', data) if isinstance(data, dict) else data)} items")


class TestExistingP1Features:
    """Verify P1 features still work"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@primepotions.com",
            "password": "admin123"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_formulas_list(self, auth_headers):
        """Test formulas list endpoint"""
        response = requests.get(f"{BASE_URL}/api/formulas", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        print(f"Formulas: {len(data)} found")
    
    def test_excel_export_raw_materials(self, auth_headers):
        """Test raw materials Excel export"""
        response = requests.get(
            f"{BASE_URL}/api/excel/prime-potions/raw-materials",
            headers=auth_headers
        )
        assert response.status_code == 200
        assert "spreadsheetml" in response.headers.get("content-type", "")
        print(f"Raw materials export: {len(response.content)} bytes")
    
    def test_excel_export_batching_template(self, auth_headers):
        """Test batching template Excel export"""
        response = requests.get(
            f"{BASE_URL}/api/excel/prime-potions/batching-template",
            headers=auth_headers
        )
        assert response.status_code == 200
        assert "spreadsheetml" in response.headers.get("content-type", "")
        print(f"Batching template export: {len(response.content)} bytes")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
