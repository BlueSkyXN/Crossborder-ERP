import { requestData } from "../../api/client";
import type {
  ChangePasswordPayload,
  ChangePasswordResult,
  LoginPayload,
  LoginResult,
  MemberUser,
  ProfileUpdatePayload,
  RegisterPayload,
} from "./types";

export function registerMember(payload: RegisterPayload) {
  return requestData<MemberUser>({
    method: "POST",
    url: "/auth/register",
    data: payload,
  });
}

export function loginMember(payload: LoginPayload) {
  return requestData<LoginResult>({
    method: "POST",
    url: "/auth/login",
    data: payload,
  });
}

export function fetchMe() {
  return requestData<MemberUser>({
    method: "GET",
    url: "/me",
  });
}

export function updateProfile(payload: ProfileUpdatePayload) {
  return requestData<MemberUser>({
    method: "PUT",
    url: "/me/profile",
    data: payload,
  });
}

export function changePassword(payload: ChangePasswordPayload) {
  return requestData<ChangePasswordResult>({
    method: "POST",
    url: "/me/password",
    data: payload,
  });
}
