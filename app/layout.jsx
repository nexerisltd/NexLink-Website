import './globals.css';
export const metadata={title:'NexLink.Chat',description:'End-to-end encrypted messenger',manifest:'/manifest.webmanifest',icons:{icon:'/favicon.png',apple:'/apple-icon.png'}};
export const viewport={themeColor:'#030a28',width:'device-width',initialScale:1,viewportFit:'cover'};
export default function RootLayout({children}){return <html lang="en"><body>{children}</body></html>}
