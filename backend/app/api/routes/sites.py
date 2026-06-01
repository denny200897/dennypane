from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.models import Site, User
from app.schemas.schemas import ProxyApply, SiteCreate, SiteOut
from app.services import apps_service
from app.services import docker_service as ds
from app.services import proxy_service

router = APIRouter(prefix="/sites", tags=["sites"])


@router.get("", response_model=list[SiteOut])
def list_sites(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return list(db.scalars(select(Site).order_by(Site.created_at.desc())))


@router.post("", response_model=SiteOut)
def create_site(body: SiteCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    if db.scalar(select(Site).where(Site.domain == body.domain)):
        raise HTTPException(409, "A site with that domain already exists")
    site = Site(domain=body.domain, kind=body.kind, upstream_port=body.upstream_port)
    try:
        apps_service.deploy(site, body.admin_email)
    except ds.DockerUnavailable as exc:
        raise HTTPException(503, f"Docker unavailable: {exc}")
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    db.add(site)
    db.commit()
    db.refresh(site)
    return site


@router.post("/{site_id}/proxy")
def apply_proxy(site_id: int, body: ProxyApply, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    site = db.get(Site, site_id)
    if not site:
        raise HTTPException(404, "Site not found")
    try:
        result = proxy_service.write_vhost(site, enable_ssl=body.enable_ssl)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    if body.enable_ssl:
        cert = proxy_service.issue_certificate(site, body.email)
        result["certificate"] = cert
        if cert.get("issued"):
            site.ssl_enabled = True
            db.commit()
    return result


@router.delete("/{site_id}")
def delete_site(site_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    site = db.get(Site, site_id)
    if not site:
        raise HTTPException(404, "Site not found")
    proxy_service.remove_vhost(site.domain)
    if site.container_id:
        try:
            ds.container_action(site.container_id, "remove")
        except Exception:
            pass
    db.delete(site)
    db.commit()
    return {"ok": True}
