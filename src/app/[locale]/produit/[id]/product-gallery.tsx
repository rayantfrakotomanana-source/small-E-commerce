'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [selected, setSelected] = useState(images[0] ?? null);
  const t = useTranslations('Catalog');
  return <div className="product-gallery">
    <div className="gallery-main">
      {selected ? <Image src={selected} alt={name} fill priority sizes="(max-width: 800px) 100vw, 52vw" /> : <span className="photo-placeholder">JR</span>}
    </div>
    {images.length > 1 && <div className="gallery-thumbnails" aria-label={t('gallery')}>
      {images.map((image, index) => <button key={`${image}-${index}`} type="button" aria-label={`${t('photo')} ${index + 1}`} aria-pressed={selected === image} onClick={() => setSelected(image)}>
        <Image src={image} alt="" fill sizes="72px" loading="lazy" />
      </button>)}
    </div>}
  </div>;
}