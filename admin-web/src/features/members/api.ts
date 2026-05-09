import { requestData } from "../../api/client";
import type {
  MemberGrowthDetail,
  MemberQuery,
  MemberUpdatePayload,
  MemberUser,
  PointAdjustmentPayload,
  PointLedger,
  ResetPasswordPayload,
  ServiceAdminUser,
} from "./types";

type ListResponse<T> = {
  items: T[];
};

function removeEmptyParams(params: MemberQuery) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  );
}

export const memberOpsApi = {
  listMembers: (params: MemberQuery = {}) =>
    requestData<ListResponse<MemberUser>>({
      method: "GET",
      url: "/admin/members",
      params: removeEmptyParams(params),
    }).then((result) => result.items),
  getMember: (memberId: number) =>
    requestData<MemberUser>({
      method: "GET",
      url: `/admin/members/${memberId}`,
    }),
  updateMember: (memberId: number, payload: MemberUpdatePayload) =>
    requestData<MemberUser>({
      method: "PATCH",
      url: `/admin/members/${memberId}`,
      data: payload,
    }),
  freezeMember: (memberId: number) =>
    requestData<MemberUser>({
      method: "POST",
      url: `/admin/members/${memberId}/freeze`,
    }),
  unfreezeMember: (memberId: number) =>
    requestData<MemberUser>({
      method: "POST",
      url: `/admin/members/${memberId}/unfreeze`,
    }),
  resetPassword: (memberId: number, payload: ResetPasswordPayload) =>
    requestData<MemberUser>({
      method: "POST",
      url: `/admin/members/${memberId}/reset-password`,
      data: payload,
    }),
  getMemberGrowth: (memberId: number) =>
    requestData<MemberGrowthDetail>({
      method: "GET",
      url: `/admin/members/${memberId}/growth`,
    }),
  adjustMemberPoints: (memberId: number, payload: PointAdjustmentPayload) =>
    requestData<PointLedger>({
      method: "POST",
      url: `/admin/members/${memberId}/points/adjust`,
      data: payload,
    }),
  listServiceAdmins: () =>
    requestData<ListResponse<ServiceAdminUser>>({
      method: "GET",
      url: "/admin/member-service-admins",
    }).then((result) => result.items),
};
