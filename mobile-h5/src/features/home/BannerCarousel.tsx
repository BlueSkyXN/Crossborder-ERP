import { Autoplay, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

import "swiper/css";
import "swiper/css/pagination";

import styles from "../../pages/PurchaseMobile.module.css";

const banners = [
  {
    title: "新人优惠",
    description: "首单代购服务费立享优惠",
    tone: "linear-gradient(135deg, #0f766e, #14b8a6)",
  },
  {
    title: "限时折扣",
    description: "精选好物每日上新特价",
    tone: "linear-gradient(135deg, #f97316, #facc15)",
  },
  {
    title: "集运特惠",
    description: "购物满额享跨境集运福利",
    tone: "linear-gradient(135deg, #2563eb, #7c3aed)",
  },
];

export function BannerCarousel() {
  return (
    <section className={styles.bannerCarousel} aria-label="商城活动轮播">
      <Swiper
        modules={[Autoplay, Pagination]}
        autoplay={{ delay: 2800, disableOnInteraction: false }}
        pagination={{ clickable: true }}
        loop
      >
        {banners.map((banner) => (
          <SwiperSlide key={banner.title}>
            <div className={styles.bannerSlide} style={{ background: banner.tone }}>
              <span>活动专区</span>
              <strong>{banner.title}</strong>
              <p>{banner.description}</p>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
}
