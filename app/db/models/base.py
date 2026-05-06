from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


def enum_values(enum_cls):
    return [item.value for item in enum_cls]
