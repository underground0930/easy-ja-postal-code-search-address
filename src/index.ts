import { ZipIndex, ZipData, ZipAllData, ReturnDataType } from './type'

export class SearchAddress {
  private isReady: boolean = false
  private isLoading: boolean = false
  private controller: AbortController = new AbortController()
  private baseUrl: string = ''
  private fallback?: () => void
  private zipCache: ZipAllData = {}
  private zipIndex: ZipIndex = []

  constructor({ baseUrl, fallback }: { baseUrl: string; fallback?: () => void }) {
    this.baseUrl = baseUrl
    this.fallback = fallback
    this.#init()
  }

  async #init() {
    const result = await this.#fetchData<ZipIndex>(this.baseUrl, 'index.json')
    if (!result) {
      console.log('index.json fetch failed')
      this.fallback?.()
      return
    }
    this.isReady = true
    this.zipIndex = result
  }

  public fetchAbort() {
    this.controller.abort()
  }

  async #fetchData<T>(baseUrl: string, url: string): Promise<T | null> {
    this.isLoading = true
    const result = await fetch(baseUrl + url, {
      signal: this.controller.signal,
    })
      .then((response) => {
        if (response.ok || response.status === 304) {
          return response.json()
        }
        throw new Error('response error')
      })
      .catch((err) => {
        console.error(err)
        return null
      })
      .finally(() => {
        this.isLoading = false
      })

    return result
  }

  #isValidInputValue(val: string): boolean {
    return /^[0-9]{7}$/.test(val)
  }

  #isExistFirstThreeDigits(zipIndex: string[], firstThreeDigits: string): boolean {
    return zipIndex.includes(firstThreeDigits)
  }

  #isExistCache(firstThreeDigits: string): ZipData[] | undefined {
    return this.zipCache[firstThreeDigits]
  }

  async search({ zipInput }: { zipInput: string }): Promise<ReturnDataType> {
    if (!this.isReady) return { address: null, error: { notReady: true } }
    if (this.isLoading) return { address: null, error: { loading: true } }
    if (!this.#isValidInputValue(zipInput)) return { address: null, error: { inValid: true } }
    const firstThreeDigits = zipInput.slice(0, 3)
    if (!this.#isExistFirstThreeDigits(this.zipIndex, firstThreeDigits)) {
      return { address: null, error: { noFirstThreeDigits: true } }
    }
    if (!this.#isExistCache(firstThreeDigits)) {
      const targetJsonData = await this.#fetchData<ZipData[]>(this.baseUrl, `${firstThreeDigits}.json`)
      if (!targetJsonData) return { address: null, error: { notFound: true } }
      this.zipCache[firstThreeDigits] = targetJsonData
    }
    const address = this.zipCache[firstThreeDigits].find((z) => z.zip === zipInput)
    if (!address) return { address: null, error: { notFound: true } }
    return { address, error: null }
  }
}
