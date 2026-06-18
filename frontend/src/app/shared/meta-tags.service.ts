import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { Auto, DealerProfile } from '../models';
import { AUTO_SHARE_TAGLINE } from './brand.constants';
import { getAutoPrimaryImageUrl, getAutoShareSubtitle, toAbsoluteUrl } from './auto-share.util';

@Injectable({ providedIn: 'root' })
export class MetaTagsService {
  private meta = inject(Meta);
  private title = inject(Title);

  private readonly defaultTitle = 'Trámites Vehiculares | Gestores y Autos';
  private readonly defaultDescription = 'Directorio nacional de gestores y autos seminuevos verificados.';

  setAutoShareTags(auto: Auto) {
    const subtitle = getAutoShareSubtitle(auto);
    const image = toAbsoluteUrl(getAutoPrimaryImageUrl(auto));
    const url = typeof window !== 'undefined' ? window.location.href : '';

    this.title.setTitle(subtitle);
    this.meta.updateTag({ name: 'description', content: subtitle });
    this.setOg('og:title', AUTO_SHARE_TAGLINE);
    this.setOg('og:description', subtitle);
    this.setOg('og:url', url);
    this.setOg('og:type', 'website');
    this.setOg('og:site_name', 'Trámites Vehiculares de México');
    if (image) {
      this.setOg('og:image', image);
      this.setOg('og:image:alt', subtitle);
    }
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: AUTO_SHARE_TAGLINE });
    this.meta.updateTag({ name: 'twitter:description', content: subtitle });
    if (image) {
      this.meta.updateTag({ name: 'twitter:image', content: image });
    }
  }

  setDealerShareTags(dealer: Pick<DealerProfile, 'name' | 'logoUrl' | 'slug'>) {
    const subtitle = dealer.name;
    const image = dealer.logoUrl && dealer.slug
      ? toAbsoluteUrl(`/og/dealer/${dealer.slug}.jpg`)
      : toAbsoluteUrl(dealer.logoUrl);
    const url = typeof window !== 'undefined' ? window.location.href : '';

    this.title.setTitle(subtitle);
    this.meta.updateTag({ name: 'description', content: subtitle });
    this.setOg('og:title', AUTO_SHARE_TAGLINE);
    this.setOg('og:description', subtitle);
    this.setOg('og:url', url);
    this.setOg('og:type', 'website');
    this.setOg('og:site_name', 'Trámites Vehiculares de México');
    if (image) {
      this.setOg('og:image', image);
      this.setOg('og:image:alt', subtitle);
    } else {
      this.meta.removeTag("property='og:image'");
      this.meta.removeTag("property='og:image:alt'");
    }
    this.meta.updateTag({ name: 'twitter:card', content: image ? 'summary_large_image' : 'summary' });
    this.meta.updateTag({ name: 'twitter:title', content: AUTO_SHARE_TAGLINE });
    this.meta.updateTag({ name: 'twitter:description', content: subtitle });
    if (image) {
      this.meta.updateTag({ name: 'twitter:image', content: image });
    } else {
      this.meta.removeTag("name='twitter:image'");
    }
  }

  reset() {
    this.title.setTitle(this.defaultTitle);
    this.meta.updateTag({ name: 'description', content: this.defaultDescription });
    this.setOg('og:title', this.defaultTitle);
    this.setOg('og:description', this.defaultDescription);
    this.meta.removeTag("property='og:image'");
    this.meta.removeTag("property='og:image:alt'");
    this.meta.removeTag("name='twitter:image'");
  }

  private setOg(property: string, content: string) {
    this.meta.updateTag({ property, content });
  }
}
