import Image from 'next/image'

export default function Franja() {
  return (
    <div className="franja parallax">
      <Image
        src="/imagenes/detalle-reformer.jpg"
        alt="Primer plano de los resortes y las correas de un reformer"
        fill
        sizes="100vw"
      />
    </div>
  )
}
