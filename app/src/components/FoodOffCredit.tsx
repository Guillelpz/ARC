// Atribución de Open Food Facts (licencia ODbL) para alimentos con source 'off'
export function FoodOffCredit({ ean }: { ean: string }) {
  return (
    <p className="text-xs text-hero-muted">
      Datos de <a href={`https://world.openfoodfacts.org/product/${ean}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-hero-text underline outline-hero focus-visible:outline-2 focus-visible:outline-offset-2">Open Food Facts (ODbL)</a>
    </p>
  )
}
