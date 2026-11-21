// ── Legal pages (Terms, Privacy, Cookies, Accessibility), the site footer, and the
// terms note shown on every ticket-buying screen. Plain React.createElement like the rest.

const LEGAL_EMAIL = 'dance@rntech.live';
const LEGAL_UPDATED = 'January 2026';

// Each doc: title + sections of [heading, [paragraphs or {list:[...]}]]
const LEGAL_DOCS = {
  terms: {
    title: 'Terms & Conditions',
    intro: 'These terms apply to every ticket you buy or claim from RNTECH, and to using rntech.live. By buying or claiming a ticket you agree to them, so please read them first.',
    sections: [
      ['Who we are', [
        `RNTECH runs RnB and tech house events in St Albans. In these terms "we", "us" and "RNTECH" mean RNTECH. You can contact us at ${LEGAL_EMAIL}.`,
      ]],
      ['Buying tickets', [
        'Your order is confirmed once payment has gone through and you receive your ticket. Payments are taken securely by Stripe. Prices are in pounds sterling and include any fees shown at checkout.',
        'Each ticket admits one person, once. Your ticket is linked to the name and email you enter and is kept under My Tickets in your RNTECH account. Keep your QR code private — the first scan gets in, and copies of the same ticket will be refused.',
        'Free tickets are subject to the same terms as paid tickets.',
      ]],
      ['No refunds', [
        'All ticket sales are final. Tickets cannot be refunded, exchanged or cancelled once bought, including if you can no longer attend, change your mind, arrive late, or are refused entry for breaking these terms or the venue\'s rules.',
        'Because tickets are for an event on a specific date, the 14-day cancellation period under the Consumer Contracts Regulations 2013 does not apply (regulation 28(1)(b)).',
        'The only exception is if we cancel or move the event — see below.',
      ]],
      ['If we cancel or change the event', [
        'If we cancel an event, we will refund the price you paid for your tickets to your original payment method, normally within 14 days.',
        `If we move an event to a new date, your ticket stays valid for the new date. If you can't make the new date, email ${LEGAL_EMAIL} within 14 days of us announcing the change and we will refund you.`,
        'Line-ups, set times, the running order and on-the-day details can change. These changes are not a cancellation and don\'t give a right to a refund.',
      ]],
      ['Entry, age and ID', [
        'Age restrictions depend on the event and the venue, and are shown on the event listing. Events at The White Swan are strictly 21+. Valid photo ID may be required for entry and you won\'t be let in without it.',
        'The venue and its door team can refuse entry or remove anyone at any time, including for being under age, too drunk, aggressive or behaving unsafely. Bags may be searched. The venue\'s own rules and licensing conditions apply at all times.',
      ]],
      ['Resale', [
        'Tickets may not be resold for more than you paid. We can cancel, without refund, tickets we reasonably believe were bought for resale or touting.',
      ]],
      ['Discounts, offers and giveaways', [
        'Discount codes, QR links and personal offers can be withdrawn at any time, can\'t be combined, and can\'t be applied after you\'ve bought. Prizes and giveaways are at our discretion and have no cash alternative.',
      ]],
      ['Photos and filming', [
        'Our events are photographed and filmed. By attending you agree that you may appear in photos and video that we use to promote RNTECH. If you\'d like a photo of you taken down, email us and we\'ll remove it.',
      ]],
      ['Your account', [
        'When you buy or claim a ticket we set up a free RNTECH account with your details so your tickets are always available. Keep your login details safe and tell us if you think someone else has used your account.',
      ]],
      ['Our liability', [
        'We are not responsible for loss of or damage to personal belongings at our events, or for losses that weren\'t foreseeable. Nothing in these terms limits our liability for death or personal injury caused by our negligence, for fraud, or for anything else that can\'t be limited by law, and nothing affects your statutory rights.',
      ]],
      ['Changes and law', [
        'We may update these terms from time to time; the version shown when you bought your ticket applies to that order. These terms are governed by the law of England and Wales.',
      ]],
    ],
  },

  privacy: {
    title: 'Privacy Policy',
    intro: `This explains what personal information RNTECH collects, why, and your rights over it. RNTECH is the data controller. Questions or requests: ${LEGAL_EMAIL}.`,
    sections: [
      ['What we collect', [
        { list: [
          'Your name, email address and, if you choose to add it, your Instagram handle.',
          'Your account password — stored only in scrambled (hashed) form, so nobody can read it.',
          'Your tickets and orders: event, ticket type, quantity, price paid, any discount used, and whether your ticket has been scanned at the door.',
          'Messages you send us through the contact form, and any guest list or interest registrations.',
          'At checkout: your IP address and browser details, used for fraud prevention and to measure our adverts (see Meta below).',
          'Anonymous visit statistics — which pages are viewed and where visits come from. These use no cookies and we never store your IP address for them.',
        ]},
        'Card details are entered on Stripe\'s secure checkout. We never see or store your card number.',
      ]],
      ['Why we use it', [
        { list: [
          'To sell and issue tickets, run your account and check you in at the door — needed to fulfil our contract with you.',
          'To answer your messages and handle any refund owed if an event is cancelled.',
          'To send you news about future RNTECH events. If you\'ve bought a ticket we may email you about similar events; you can opt out at any time by emailing us or replying to any email.',
          'To keep the site secure, prevent fraud and understand how the site is used — our legitimate interests.',
          'To measure and improve our Instagram and Facebook adverts — using the Meta Pixel only if you accept cookies, and the Conversions API when you check out (our legitimate interest in knowing which adverts work).',
        ]},
      ]],
      ['Who we share it with', [
        { list: [
          'Stripe — processes card payments.',
          'Meta (Facebook / Instagram) — if you accept cookies, the Meta Pixel runs on our site; when you check out we send Meta your email address in scrambled (hashed) form along with your IP address and browser details, so we can tell which adverts led to ticket sales.',
          'Our email provider — to deliver tickets and event emails.',
          'Fly.io — hosts our website and database in London.',
          'The venue and door team — names on the guest list, for entry checks on the night.',
        ]},
        'We never sell your personal information. Some of these providers may process data outside the UK; where they do, they use approved safeguards such as standard contractual clauses.',
      ]],
      ['How long we keep it', [
        'Account details stay until you ask us to delete your account. Order and payment records are kept for six years for tax and accounting. Contact messages are kept for up to two years. Anonymous visit statistics are deleted after about 13 months.',
      ]],
      ['Your rights', [
        `You can ask to see the information we hold about you, have it corrected or deleted, restrict or object to how we use it, get a copy to take elsewhere, or withdraw any consent you've given. Email ${LEGAL_EMAIL} and we'll respond within one month.`,
        'If you\'re unhappy with how we\'ve handled your information, you can complain to the Information Commissioner\'s Office at ico.org.uk.',
      ]],
      ['Changes', [
        'We\'ll update this page if anything changes. The date at the top shows when it was last updated.',
      ]],
    ],
  },

  cookies: {
    title: 'Cookie Policy',
    intro: 'Cookies and similar technologies are small pieces of data stored by your browser. Here\'s what rntech.live uses.',
    sections: [
      ['Strictly necessary', [
        { list: [
          'Sign-in storage (rntech_token, rntech_user) — keeps you signed in so your tickets show under My Tickets. Stored in your browser\'s local storage and only used by this site.',
          'Stripe — when you pay, Stripe\'s checkout page sets its own cookies to process the payment securely and prevent fraud.',
        ]},
      ]],
      ['Advertising', [
        { list: [
          'Meta Pixel (_fbp and related Meta cookies) — tells Meta when our site is visited so we can measure and improve our adverts on Instagram and Facebook. This is only switched on if you choose Accept on our cookie banner. You can also control how Meta uses it in your Facebook or Instagram ad settings.',
        ]},
      ]],
      ['Visit statistics', [
        'Our own visit counter uses no cookies and stores nothing on your device.',
      ]],
      ['Managing cookies', [
        'You can change your choice at any time using Cookie settings at the bottom of any page. Your choice is remembered in your browser so we don\'t ask every visit.',
        `You can also block or delete cookies in your browser settings. Blocking the sign-in storage will sign you out. Questions: ${LEGAL_EMAIL}.`,
      ]],
    ],
  },

  accessibility: {
    title: 'Accessibility Statement',
    intro: 'We want everyone to be able to use rntech.live and enjoy our events.',
    sections: [
      ['This website', [
        'We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA. The site works on phones, tablets and computers, text can be enlarged with your browser\'s zoom, and the ticket checkout is handled by Stripe, which is built to be accessible.',
      ]],
      ['Known issues', [
        { list: [
          'Some small text on event posters and images may be hard to read, and posters don\'t always repeat every detail as text.',
          'Mixes are audio and video without transcripts.',
          'Some parts of the site may not yet work perfectly with screen readers.',
        ]},
        'We\'re working to improve these.',
      ]],
      ['At our events', [
        `If you have access needs — step-free access, a carer or companion, seating, or anything else — email ${LEGAL_EMAIL} before you buy and we'll check with the venue and let you know what's possible.`,
      ]],
      ['Feedback and help', [
        `If you can't use any part of this site, need information in a different format, or want to report a problem, email ${LEGAL_EMAIL}. We'll get back to you as soon as we can.`,
      ]],
    ],
  },
};

const LEGAL_LINKS = [
  ['terms', 'Terms'], ['privacy', 'Privacy'], ['cookies', 'Cookies'], ['accessibility', 'Accessibility'],
];

const legalFont = "'Space Grotesk',sans-serif";

function LegalBody({ doc }) {
  const d = LEGAL_DOCS[doc];
  const p = (t, i) => typeof t === 'string'
    ? React.createElement('p', { key: i, style: { color: 'rgba(255,255,255,0.72)', fontSize: 15, lineHeight: 1.65, margin: '0 0 12px' } }, t)
    : React.createElement('ul', { key: i, style: { color: 'rgba(255,255,255,0.72)', fontSize: 15, lineHeight: 1.6, margin: '0 0 12px', paddingLeft: 20 } },
        t.list.map((li, j) => React.createElement('li', { key: j, style: { marginBottom: 6 } }, li)));
  return React.createElement('div', { style: { fontFamily: legalFont } },
    React.createElement('h1', { style: { fontWeight: 800, fontSize: 30, color: '#fff', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.01em' } }, d.title),
    React.createElement('p', { style: { color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: '0 0 22px' } }, 'Last updated ' + LEGAL_UPDATED),
    React.createElement('p', { style: { color: 'rgba(255,255,255,0.85)', fontSize: 16, lineHeight: 1.6, margin: '0 0 26px' } }, d.intro),
    d.sections.map(([h, body], i) => React.createElement('section', { key: i, style: { marginBottom: 22 } },
      React.createElement('h2', { style: { fontWeight: 700, fontSize: 17, color: '#fff', margin: '0 0 10px' } }, h),
      body.map(p)
    ))
  );
}

// Full page at /terms, /privacy, /cookies, /accessibility
function PageLegal({ doc, onNavigate }) {
  return React.createElement('div', { style: { padding: '100px 24px 40px', maxWidth: 760, margin: '0 auto' } },
    React.createElement(LegalBody, { doc }),
    React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 28, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.08)' } },
      LEGAL_LINKS.filter(([id]) => id !== doc).map(([id, label]) =>
        React.createElement('button', { key: id, onClick: () => onNavigate(id), style: legalLinkStyle }, label))
    )
  );
}

const legalLinkStyle = {
  background: 'none', border: 'none', padding: '6px 0', cursor: 'pointer', fontFamily: legalFont,
  color: 'rgba(255,255,255,0.45)', fontSize: 12, letterSpacing: '0.04em',
  textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.2)', textUnderlineOffset: 3,
};

// Small, quiet footer at the bottom of every public page
function SiteFooter({ onNavigate }) {
  return React.createElement('footer', { className: 'site-footer', style: { position: 'relative', zIndex: 1, padding: '28px 24px 32px', textAlign: 'center', fontFamily: legalFont } },
    React.createElement('div', { role: 'navigation', 'aria-label': 'Legal', style: { display: 'flex', justifyContent: 'center', flexWrap: 'wrap', columnGap: 18, rowGap: 2 } },
      LEGAL_LINKS.map(([id, label]) =>
        React.createElement('button', { key: id, onClick: () => onNavigate(id), style: { ...legalLinkStyle, textDecoration: 'none' } }, label)),
      React.createElement('button', { onClick: () => window.dispatchEvent(new Event('rt-cookie-settings')), style: { ...legalLinkStyle, textDecoration: 'none' } }, 'Cookie settings')
    ),
    React.createElement('p', { style: { color: 'rgba(255,255,255,0.28)', fontSize: 11, margin: '8px 0 0', letterSpacing: '0.04em' } },
      '© ' + new Date().getFullYear() + ' RNTECH · ',
      React.createElement('a', { href: 'mailto:' + LEGAL_EMAIL, style: { color: 'inherit' } }, LEGAL_EMAIL))
  );
}

// Terms opened on top of a ticket modal, so the half-filled purchase isn't lost
function LegalSheet({ doc, onClose }) {
  return React.createElement('div', { className: 'modal-overlay', onClick: onClose, style: { position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 } },
    React.createElement('div', { className: 'modal-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': LEGAL_DOCS[doc].title, onClick: e => e.stopPropagation(), style: { background: '#040c18', border: '1px solid rgba(50,114,168,0.3)', padding: 22, width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' } },
      React.createElement('div', { className: 'modal-head', style: { display: 'flex', justifyContent: 'flex-end', marginBottom: 4 } },
        React.createElement('button', { onClick: onClose, 'aria-label': 'Close', style: { background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', fontFamily: legalFont, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '10px 14px' } }, 'Close')
      ),
      React.createElement(LegalBody, { doc })
    )
  );
}

// One line above every "pay / confirm" button
function TicketTermsNote() {
  const [open, setOpen] = React.useState(false);
  return React.createElement(React.Fragment, null,
    React.createElement('p', { style: { fontFamily: legalFont, color: 'rgba(255,255,255,0.45)', fontSize: 10.5, lineHeight: 1.45, margin: '0 0 8px' } },
      'By continuing you agree to our ',
      React.createElement('button', { type: 'button', onClick: () => setOpen(true), style: { background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: legalFont, fontSize: 'inherit', color: 'rgba(255,255,255,0.75)', textDecoration: 'underline', textUnderlineOffset: 2 } }, 'Terms & Conditions'),
      '. All sales are final — tickets are non-refundable unless the event is cancelled.'
    ),
    open && ReactDOM.createPortal(React.createElement(LegalSheet, { doc: 'terms', onClose: () => setOpen(false) }), document.body)
  );
}


// Small consent card: the Meta Pixel (advertising cookie) only loads after Accept.
const CONSENT_KEY = 'rt_cookie_consent';
function readConsent() { try { return localStorage.getItem(CONSENT_KEY); } catch (e) { return null; } }

function CookieBanner({ onNavigate }) {
  const [open, setOpen] = React.useState(() => !readConsent());
  React.useEffect(() => {
    const reopen = () => setOpen(true);
    window.addEventListener('rt-cookie-settings', reopen);
    return () => window.removeEventListener('rt-cookie-settings', reopen);
  }, []);
  if (!open) return null;
  const choose = (v) => {
    try { localStorage.setItem(CONSENT_KEY, v); } catch (e) {}
    if (v === 'accept') { if (window.rtLoadPixel) window.rtLoadPixel(); }
    else {
      // withdrawing: clear Meta's cookies; the pixel stays off from the next page load
      ['_fbp', '_fbc'].forEach(n => { document.cookie = n + '=; Max-Age=0; path=/; domain=.' + location.hostname.replace(/^www\./, ''); document.cookie = n + '=; Max-Age=0; path=/'; });
    }
    setOpen(false);
  };
  const btn = { fontFamily: legalFont, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '11px 16px', minHeight: 44, cursor: 'pointer', borderRadius: 0, flex: 1 };
  return React.createElement('div', { className: 'cookie-banner', role: 'region', 'aria-label': 'Cookie choice', style: { position: 'fixed', left: 16, bottom: 16, zIndex: 400, width: 'min(360px, calc(100vw - 32px))', background: 'rgba(4,12,24,0.96)', border: '1px solid rgba(50,114,168,0.3)', padding: 16, fontFamily: legalFont, boxShadow: '0 10px 40px rgba(0,0,0,0.5)' } },
    React.createElement('p', { style: { color: 'rgba(255,255,255,0.75)', fontSize: 12.5, lineHeight: 1.5, margin: '0 0 12px' } },
      'We\'d like to use a Meta advertising cookie to see which of our Instagram and Facebook ads work. ',
      React.createElement('button', { type: 'button', onClick: () => onNavigate('cookies'), style: { background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: legalFont, fontSize: 'inherit', color: '#fff', textDecoration: 'underline', textUnderlineOffset: 2 } }, 'Cookie policy')
    ),
    React.createElement('div', { style: { display: 'flex', gap: 8 } },
      React.createElement('button', { type: 'button', onClick: () => choose('reject'), style: { ...btn, background: 'none', border: '1px solid rgba(255,255,255,0.25)', color: 'rgba(255,255,255,0.85)' } }, 'Reject'),
      React.createElement('button', { type: 'button', onClick: () => choose('accept'), style: { ...btn, background: '#3272a8', border: '1px solid #3272a8', color: '#fff' } }, 'Accept')
    )
  );
}

Object.assign(window, { PageLegal, SiteFooter, TicketTermsNote, LegalSheet, LEGAL_DOCS, CookieBanner });
