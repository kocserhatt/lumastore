"""guest checkout + delivery method

Revision ID: 7c1e2a9b4d10
Revises: 409bbbdf0125
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '7c1e2a9b4d10'
down_revision: Union[str, Sequence[str], None] = '409bbbdf0125'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column('orders', 'user_id', existing_type=sa.String(64), nullable=True)
    op.add_column('orders', sa.Column('delivery_method', sa.String(16), nullable=False, server_default=sa.text("'adres'")))
    op.add_column('orders', sa.Column('access_token', sa.String(64), nullable=True))


def downgrade() -> None:
    op.drop_column('orders', 'access_token')
    op.drop_column('orders', 'delivery_method')
    op.alter_column('orders', 'user_id', existing_type=sa.String(64), nullable=False)
