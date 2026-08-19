from typing import Dict, List, Any

# All 18 granular permission tokens grouped by module
PERMISSION_REGISTRY: Dict[str, Dict[str, Any]] = {
    "pos": {
        "title": "POS & Sales",
        "icon": "ShoppingCart",
        "permissions": [
            {
                "id": "pos:sell",
                "label": "Process Counter Sales",
                "description": "Scan barcodes, ring up sales, take payments, and issue receipts"
            },
            {
                "id": "pos:discount",
                "label": "Apply Custom Discounts",
                "description": "Apply discretionary discounts or negotiate below standard selling price"
            },
            {
                "id": "pos:quotes",
                "label": "Create Quotes & Proformas",
                "description": "Draft customer quotations and proforma pre-sale documents"
            },
            {
                "id": "pos:void",
                "label": "Void Invoices & Sales",
                "description": "Cancel completed sales transactions and return items to inventory"
            },
            {
                "id": "pos:view_margin",
                "label": "View Cost Margins (BP)",
                "description": "Display product buying price and profit margin in POS counter and drawers"
            }
        ]
    },
    "catalog_inventory": {
        "title": "Catalog & Stock",
        "icon": "Boxes",
        "permissions": [
            {
                "id": "catalog:manage",
                "label": "Manage Catalog & Pricing",
                "description": "Add, edit, or deactivate products, categories, roll metrics, and tax rates"
            },
            {
                "id": "inventory:view",
                "label": "View Stock Balances",
                "description": "Check current on-hand quantities, roll lengths, and reorder levels"
            },
            {
                "id": "inventory:adjust",
                "label": "Manual Stock Adjustments",
                "description": "Manually add, subtract, or reconcile damaged/found physical inventory"
            },
            {
                "id": "inventory:stock_take",
                "label": "Execute Stock Take",
                "description": "Initiate, record physical counts, and reconcile inventory variances"
            }
        ]
    },
    "purchases": {
        "title": "Purchases & Suppliers",
        "icon": "Truck",
        "permissions": [
            {
                "id": "purchases:orders",
                "label": "Create Purchase Orders",
                "description": "Draft and submit POs to suppliers for inventory restocking"
            },
            {
                "id": "purchases:receive_grn",
                "label": "Receive Goods (GRN)",
                "description": "Log Goods Received Notes and accept physical delivery into stock"
            },
            {
                "id": "suppliers:manage",
                "label": "Manage Supplier Accounts",
                "description": "Create suppliers, record payment vouchers, and track payables"
            }
        ]
    },
    "financials_reports": {
        "title": "Financials & Reports",
        "icon": "BarChart3",
        "permissions": [
            {
                "id": "reports:view_net_profit",
                "label": "View Net Profit Statements",
                "description": "Access full management P&L statements, COGS, and operating margins"
            },
            {
                "id": "reports:view_sales",
                "label": "View Sales & ETR Reports",
                "description": "Access daily sales summaries, payment method breakdowns, and tax stats"
            },
            {
                "id": "accounts:petty_cash",
                "label": "Petty Cash & Expenses",
                "description": "Disburse and log petty cash vouchers and operational store expenses"
            },
            {
                "id": "accounts:banking_mpesa",
                "label": "Bank & M-Pesa Accounts",
                "description": "Manage store bank accounts and log M-Pesa agent commission floats"
            },
            {
                "id": "customers:credit_ledger",
                "label": "Customer Credit Ledgers",
                "description": "View customer debt balances, issue store credit, and record debt payments"
            },
            {
                "id": "projects:manage",
                "label": "Solar Installation Projects",
                "description": "Manage project workspaces, material BOM allocations, and external labor"
            }
        ]
    },
    "admin": {
        "title": "Admin & Settings",
        "icon": "Shield",
        "permissions": [
            {
                "id": "admin:settings",
                "label": "Manage Store Settings",
                "description": "Update store profile details, physical address, and default VAT rates"
            },
            {
                "id": "admin:expenses",
                "label": "Manage Recurring Overheads",
                "description": "Configure fixed monthly rent, payroll, and utility deductions"
            },
            {
                "id": "admin:users",
                "label": "User Management & RBAC",
                "description": "Create, edit, reset passwords, and configure access permissions for staff"
            }
        ]
    }
}

# Role Presets mapping to default permission lists
ROLE_PRESET_PERMISSIONS: Dict[str, List[str]] = {
    "owner": ["*"],
    "accountant": [
        "pos:quotes",
        "catalog:manage",
        "inventory:view",
        "purchases:orders",
        "purchases:receive_grn",
        "suppliers:manage",
        "reports:view_net_profit",
        "reports:view_sales",
        "accounts:petty_cash",
        "accounts:banking_mpesa",
        "customers:credit_ledger",
        "projects:manage"
    ],
    "staff": [
        "pos:sell",
        "pos:quotes",
        "inventory:view",
        "purchases:receive_grn",
        "customers:credit_ledger",
        "accounts:petty_cash"
    ],
    "storekeeper": [
        "inventory:view",
        "inventory:adjust",
        "inventory:stock_take",
        "catalog:manage",
        "purchases:receive_grn"
    ],
    "project_manager": [
        "pos:quotes",
        "inventory:view",
        "projects:manage",
        "purchases:receive_grn",
        "customers:credit_ledger"
    ]
}
