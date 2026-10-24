import { Logo } from '../components/Logo'

export function SplashScreen() {
  return (
    <div className="splash" role="status" aria-label="جارٍ فتح قِرْش">
      <Logo size={96} />
      <p className="splash__name">قِرْش</p>
      <p className="splash__tagline">مصاريفك تحت السيطرة</p>
    </div>
  )
}
