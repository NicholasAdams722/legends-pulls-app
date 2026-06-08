export type StoreType = "retail" | "warehouse";
export type UserRole = "manager" | "warehouse" | "admin";
export type GoodType = "soft" | "hard";
export type PullStatus =
  | "available"
  | "claimed"
  | "to_warehouse"
  | "received"
  | "cancelled";

export type Store = {
  id: string;
  code: number;
  name: string;
  type: StoreType;
};

export type AppUser = {
  id: string;
  name: string;
  email: string;
  store_id: string;
  role: UserRole;
  employee_code: string | null;
  created_at: string;
};

export type PullLine = {
  id: string;
  pull_id: string;
  sku: string;
  color: string | null;
  size: string | null;
  quantity: number;
};

export type PullPass = {
  id: string;
  pull_id: string;
  store_id: string;
  user_id: string;
  passed_at: string;
};

export type Pull = {
  id: string;
  photo_urls: string[];
  style_name: string;
  good_type: GoodType;
  description: string | null;
  from_store_id: string;
  posted_by: string;
  status: PullStatus;
  claimed_by_store_id: string | null;
  claimed_by_user_id: string | null;
  claimed_at: string | null;
  received_at: string | null;
  created_at: string;
};

export type PullWithLines = Pull & {
  pull_lines: PullLine[];
  from_store: Store;
  posted_by_user: Pick<AppUser, "id" | "name"> | null;
  claimed_by_store: Store | null;
};
