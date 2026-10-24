from fastapi import APIRouter
from pydantic import BaseModel

from ...services.slskd_client import slskd_client

router = APIRouter()

class SearchPayload(BaseModel):
    query: str

@router.get("/status")
async def get_slskd_status():
    available = await slskd_client.is_available()
    return {"enabled": slskd_client.enabled, "connected": available}

@router.post("/search")
async def start_soulseek_search(data: SearchPayload):
    return await slskd_client.search(data.query)

@router.get("/search/{search_id}")
async def get_soulseek_results(search_id: str):
    results = await slskd_client.get_search_results(search_id)
    return {"results": results}
