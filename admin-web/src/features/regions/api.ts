import { requestData } from "../../api/client";

export type Region = {
  id: number;
  parent_id: number | null;
  parent_name?: string | null;
  name: string;
  code: string;
  level: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type RegionQueryParams = {
  parent_id?: number;
  keyword?: string;
  is_active?: string;
};

export type RegionPayload = {
  parent_id?: number | null;
  name: string;
  code: string;
  level: string;
  is_active: boolean;
};

type ListResponse<T> = {
  items: T[];
};

export function fetchAdminRegions(params?: RegionQueryParams) {
  return requestData<ListResponse<Region>>({
    method: "GET",
    url: "/admin/regions",
    params,
  }).then((result) => result.items);
}

export function createRegion(data: RegionPayload) {
  return requestData<Region>({
    method: "POST",
    url: "/admin/regions",
    data,
  });
}

export function updateRegion(id: number, data: RegionPayload) {
  return requestData<Region>({
    method: "PUT",
    url: `/admin/regions/${id}`,
    data,
  });
}

export function deleteRegion(id: number) {
  return requestData<Region>({
    method: "DELETE",
    url: `/admin/regions/${id}`,
  });
}
