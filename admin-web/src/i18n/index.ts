import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./en";
import zhCN from "./zh-CN";

i18n.use(initReactI18next).init({
  resources: {
    "zh-CN": { translation: zhCN },
    en: { translation: en },
  },
  lng: localStorage.getItem("locale") || "zh-CN",
  fallbackLng: "zh-CN",
  interpolation: { escapeValue: false },
});

export default i18n;
