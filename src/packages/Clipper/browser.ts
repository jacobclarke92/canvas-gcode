// Browser test to speedup performance critical functions
const nav = navigator.userAgent.toString().toLowerCase()
export const browser = {
  chrome: nav.indexOf('chrome') != -1 && nav.indexOf('chromium') == -1,
  chromium: nav.indexOf('chromium') != -1,
  safari: nav.indexOf('safari') != -1 && nav.indexOf('chrome') == -1 && nav.indexOf('chromium') == -1,
  firefox: nav.indexOf('firefox') != -1,
  firefox17: nav.indexOf('firefox/17') != -1,
  firefox15: nav.indexOf('firefox/15') != -1,
  firefox3: nav.indexOf('firefox/3') != -1,
  opera: nav.indexOf('opera') != -1,
  msie10: nav.indexOf('msie 10') != -1,
  msie9: nav.indexOf('msie 9') != -1,
  msie8: nav.indexOf('msie 8') != -1,
  msie7: nav.indexOf('msie 7') != -1,
  msie: nav.indexOf('msie ') != -1,
} as const
