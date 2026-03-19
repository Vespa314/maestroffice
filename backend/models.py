from typing import List, Optional
from pydantic import BaseModel, Field


class CompanyCreate(BaseModel):
    name: str = Field(..., description="公司名")


class CompanyDetail(BaseModel):
    name: str
    created_at: str


class UserCreate(BaseModel):
    company_name: str = Field(..., description="公司名")
    username: str = Field(..., description="用户名")


class UserOnDutyUpdate(BaseModel):
    is_on_duty: bool = Field(..., description="是否到岗")


class UserDetail(BaseModel):
    company_name: str
    username: str
    is_on_duty: bool


class ConversationCreate(BaseModel):
    title: str = Field(..., description="对话标题")
    members: List[str] = Field(..., description="对话成员列表")


class ConversationUpdate(BaseModel):
    title: Optional[str] = Field(None, description="对话标题")
    announcement: Optional[str] = Field(None, description="对话公告")


class MessageCreate(BaseModel):
    content: Optional[str] = Field(None, description="消息内容")
    attachment_ids: Optional[List[str]] = Field(default_factory=list, description="附件ID列表")


class AttachmentUpload(BaseModel):
    filename: str = Field(..., description="文件名")
    content: str = Field(..., description="Markdown内容")


class SoulUpdate(BaseModel):
    content: str = Field(..., description="Soul的Markdown内容")


class ConversationMemberAdd(BaseModel):
    username: str = Field(..., description="要添加的用户名")


class ConversationMembersBatchAdd(BaseModel):
    usernames: List[str] = Field(..., description="要添加的用户名列表")


class UserWorkingStatusUpdate(BaseModel):
    is_working: bool = Field(..., description="是否在工作")


class UserWorkingStatus(BaseModel):
    company_name: str
    username: str
    is_working: bool
