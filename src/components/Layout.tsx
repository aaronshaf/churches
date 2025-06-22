import { FC } from 'hono/jsx';
import { Navbar } from './Navbar';

type LayoutProps = {
  title?: string;
  children: any;
  user?: any;
};

export const Layout: FC<LayoutProps> = ({ title = 'Utah Churches', children, user }) => {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        <script src="/js/tailwind.js"></script>
        <script dangerouslySetInnerHTML={{
          __html: `
            tailwind.config = {
              theme: {
                extend: {
                  colors: {
                    primary: {
                      50: '#eff6ff',
                      100: '#dbeafe',
                      200: '#bfdbfe',
                      300: '#93bbfd',
                      400: '#60a5fa',
                      500: '#3b82f6',
                      600: '#2563eb',
                      700: '#1d4ed8',
                      800: '#1e40af',
                      900: '#1e3a8a',
                      950: '#172554',
                    }
                  },
                  fontFamily: {
                    sans: ['Inter var', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
                  },
                }
              }
            }
          `
        }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap" rel="stylesheet" />
      </head>
      <body class="bg-gray-50 text-gray-900 antialiased">
        <Navbar user={user} />
        {children}
      </body>
    </html>
  );
};