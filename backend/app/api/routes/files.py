from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.api.deps import get_current_user
from app.models.models import User
from app.schemas.schemas import FileWrite, PathBody
from app.services import files_service as fs

router = APIRouter(prefix="/files", tags=["files"])


def _wrap(fn, *a, **kw):
    try:
        return fn(*a, **kw)
    except fs.PathError as exc:
        raise HTTPException(400, str(exc))


@router.get("/list")
def list_dir(path: str = "", _: User = Depends(get_current_user)):
    return _wrap(fs.listdir, path)


@router.get("/read")
def read_file(path: str, _: User = Depends(get_current_user)):
    return {"path": path, "content": _wrap(fs.read_file, path)}


@router.post("/write")
def write_file(body: FileWrite, _: User = Depends(get_current_user)):
    return _wrap(fs.write_file, body.path, body.content)


@router.post("/mkdir")
def mkdir(body: PathBody, _: User = Depends(get_current_user)):
    return _wrap(fs.mkdir, body.path)


@router.post("/delete")
def delete(body: PathBody, _: User = Depends(get_current_user)):
    return _wrap(fs.delete, body.path)


@router.post("/upload")
async def upload(path: str = "", file: UploadFile = File(...), _: User = Depends(get_current_user)):
    try:
        return await fs.upload(path, file)
    except fs.PathError as exc:
        raise HTTPException(400, str(exc))
