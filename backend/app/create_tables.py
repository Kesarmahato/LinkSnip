from .database import Base, engine
from .models import User, Link, Click


print("Creating database tables...")

Base.metadata.create_all(bind=engine)

print("Database tables created successfully!")