# Prime Potions ERP

An ERP application for managing inventory, batching, and Excel-based data import/export.

## Stack

- **Backend:** FastAPI + MongoDB (Motor)
- **Frontend:** React (Create React App + Craco), Tailwind CSS, shadcn/radix UI

## Running locally

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --reload
```

Requires a `.env` file in `backend/` with `MONGO_URL` and `DB_NAME` set.

### Frontend

```bash
cd frontend
yarn install
yarn start
```

## Tests

```bash
cd backend
pytest tests/
```
