"""enable rls

Revision ID: 4cd3e0e1e5fc
Revises: f4bcaf859417
Create Date: 2026-10-30 15:35:27.089986

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4cd3e0e1e5fc'
down_revision: Union[str, Sequence[str], None] = 'f4bcaf859417'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    for t in ['users','products','cart_items','orders','order_items']:
        op.execute(f'ALTER TABLE {t} ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    """Downgrade schema."""
    for t in ['users','products','cart_items','orders','order_items']:
        op.execute(f'ALTER TABLE {t} DISABLE ROW LEVEL SECURITY')
