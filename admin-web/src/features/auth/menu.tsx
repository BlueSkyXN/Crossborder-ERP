import {
  DashboardOutlined,
  DatabaseOutlined,
  DeploymentUnitOutlined,
  DollarOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  InboxOutlined,
  MessageOutlined,
  SafetyOutlined,
  ShoppingCartOutlined,
  ShoppingOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import type { ReactNode } from "react";

export type AdminRouteMeta = {
  permission: string;
  resource: string;
  path: string;
  label: string;
  icon: ReactNode;
  description: string;
};

export const adminRouteMeta: AdminRouteMeta[] = [
  {
    permission: "dashboard.view",
    resource: "dashboard",
    path: "/dashboard",
    label: "控制台",
    icon: <DashboardOutlined />,
    description: "待处理事项、核心指标和系统入口。",
  },
  {
    permission: "members.view",
    resource: "members",
    path: "/members",
    label: "会员管理",
    icon: <TeamOutlined />,
    description: "会员资料、状态和服务记录。",
  },
  {
    permission: "warehouses.view",
    resource: "warehouses",
    path: "/warehouses",
    label: "仓库配置",
    icon: <DatabaseOutlined />,
    description: "仓库、渠道、包装、增值服务和费率配置。",
  },
  {
    permission: "parcels.view",
    resource: "parcels",
    path: "/parcels",
    label: "包裹管理",
    icon: <InboxOutlined />,
    description: "包裹预报、入库、在库和异常处理。",
  },
  {
    permission: "waybills.view",
    resource: "waybills",
    path: "/waybills",
    label: "运单管理",
    icon: <DeploymentUnitOutlined />,
    description: "打包、费用、发货和轨迹跟进。",
  },
  {
    permission: "finance.view",
    resource: "finance",
    path: "/finance",
    label: "财务管理",
    icon: <DollarOutlined />,
    description: "钱包、流水、充值和扣款记录。",
  },
  {
    permission: "purchases.view",
    resource: "purchases",
    path: "/purchases",
    label: "代购管理",
    icon: <ShoppingCartOutlined />,
    description: "代购订单、采购任务和到货流转。",
  },
  {
    permission: "products.view",
    resource: "products",
    path: "/products",
    label: "商品管理",
    icon: <ShoppingOutlined />,
    description: "商品资料、分类和基础上架信息。",
  },
  {
    permission: "tickets.view",
    resource: "tickets",
    path: "/tickets",
    label: "客服工单",
    icon: <MessageOutlined />,
    description: "用户留言、客服回复和工单处理状态。",
  },
  {
    permission: "content.view",
    resource: "content",
    path: "/content",
    label: "内容管理",
    icon: <FileTextOutlined />,
    description: "帮助、公告、条款和基础页面。",
  },
  {
    permission: "audit.logs.view",
    resource: "audit",
    path: "/audit-logs",
    label: "审计日志",
    icon: <FileSearchOutlined />,
    description: "后台关键操作、状态变化和敏感动作追踪。",
  },
  {
    permission: "iam.role.view",
    resource: "roles",
    path: "/roles",
    label: "角色权限",
    icon: <SafetyOutlined />,
    description: "后台角色、权限菜单和访问控制。",
  },
];

export const fallbackMenus = adminRouteMeta.map(({ permission, label, resource }) => ({
  code: permission,
  name: label,
  resource,
}));
