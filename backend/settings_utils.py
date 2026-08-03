from .models import SiteSettings


def get_setting(db, key: str, default: str = "") -> str:
    s = db.query(SiteSettings).filter(SiteSettings.key == key).first()
    return s.value if s else default


def set_setting(db, key: str, value: str):
    s = db.query(SiteSettings).filter(SiteSettings.key == key).first()
    if s:
        s.value = value
    else:
        s = SiteSettings(key=key, value=value)
        db.add(s)
    db.commit()
