// TokenAvatar — override → backend → initials fallback. For tokens
// whose backend image is empty (Canton's DevNet Amulet doesn't expose
// one), the override table at the top supplies a CoinMarketCap
// thumbnail or similar. The initials chip is the final fallback.

const TOKEN_IMAGE_OVERRIDES: Record<string, string> = {
  CC: 'https://s2.coinmarketcap.com/static/img/coins/64x64/37263.png'
}

export function TokenAvatar({ symbol }: { symbol: string }) {
  const override = TOKEN_IMAGE_OVERRIDES[symbol]
  if (override) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={override}
        alt={`${symbol} logo`}
        className='h-8 w-8 flex-shrink-0 rounded-full border border-brand-border bg-brand-light object-cover'
      />
    )
  }

  return (
    <div
      className='flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-brand-border bg-brand-light font-mono text-[10px] font-bold text-brand-navy'
      aria-hidden='true'
    >
      {symbol.slice(0, 2).toUpperCase()}
    </div>
  )
}

export default TokenAvatar
