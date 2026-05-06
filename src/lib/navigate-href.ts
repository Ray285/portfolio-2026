/**
 * In-app, mailto, and external links from 3D hit targets. Internal paths use
 * the Next `useRouter` client.
 */
export function navigateToHref(
  router: { push: (href: string) => void },
  href: string,
) {
  if (href.startsWith("/")) {
    void router.push(href);
    return;
  }
  if (href.startsWith("mailto:") || href.startsWith("tel:")) {
    window.location.href = href;
    return;
  }
  if (href.startsWith("http://") || href.startsWith("https://")) {
    window.open(href, "_blank", "noopener,noreferrer");
    return;
  }
  if (href.startsWith("#")) {
    window.location.assign(href);
  }
}
