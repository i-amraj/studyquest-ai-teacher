from pydantic import BaseModel, EmailStr, Field

class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    college: str = ""
    course: str = ""
    language: str = "hinglish"

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class RefreshIn(BaseModel):
    refresh_token: str

class UserOut(BaseModel):
    public_id: str
    name: str
    email: str
    college: str
    course: str
    language: str = "hinglish"
    xp: int
    level: int
    streak_days: int

class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut
