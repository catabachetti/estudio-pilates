import './globals.css'

export const metadata = {
  title: 'Estudio Pilates',
  description: 'Clases de pilates reformer. Reservá tu turno online.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
