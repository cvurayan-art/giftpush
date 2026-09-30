"use client";

import { WorksWheel, type WorksWheelItem } from "@/components/ui/works-wheel";

// Curated high-resolution holiday photography for the interactive showcase
const WORKS: WorksWheelItem[] = [
  {
    title: "Handcrafted Keepsakes",
    image: "/images/personalized_showcase.jpg",
    href: "#personalized",
  },
  {
    title: "Festive Traditions",
    image: "/images/tree_ornament.jpg",
    href: "#collections",
  },
  {
    title: "Winter Aromatherapy",
    image: "/images/cinnamon_candle.jpg",
    href: "#bestsellers",
  },
  {
    title: "Cozy Holiday Ceramics",
    image: "/images/cozy_mug.jpg",
    href: "#bestsellers",
  },
  {
    title: "Artisan Gourmet Hampers",
    image: "/images/gift_hamper.jpg",
    href: "#collections",
  },
  {
    title: "Golden Keepsake Boxes",
    image: "/images/personalized_box.jpg",
    href: "product.html",
  },
  {
    title: "Heirloom Knit Stockings",
    image: "/images/knit_stocking.jpg",
    href: "#budget",
  },
  {
    title: "Holiday Lights & Magic",
    image: "/images/occasion_christmas.jpg",
    href: "#occasions",
  },
  {
    title: "Thoughtful Gift Packages",
    image: "/images/hero_gift.jpg",
    href: "#gift-guide",
  },
];

export { WORKS };

export default function WorksWheelDemo() {
  return (
    <div className="w-full h-full min-h-[38rem] overflow-hidden bg-transparent border-0 shadow-none">
      <WorksWheel items={WORKS} label="Holiday Collection" action="Explore Gift" />
    </div>
  );
}
