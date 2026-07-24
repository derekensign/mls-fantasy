import { Html, Head, Main, NextScript } from "next/document";

// Fonts are loaded via <link> (not next/font) so the production build never
// depends on a build-time fetch to Google Fonts.
//   Cinzel  — inscriptional roman capitals for the engraved wordmark/headings
//   Oswald  — condensed tabular numerals for scoreboard goal tallies + labels
//   Inter   — quiet body face
export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700;800&family=Oswald:wght@300;400;500;600;700&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <meta name="theme-color" content="#0a0a0b" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
