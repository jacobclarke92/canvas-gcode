class Wow {
  private name: string

  constructor(name: string) {
    this.name = name
  }
  say() {
    console.log(`Hello ${this.name}`)
  }
}

const init = () => {
  const wow = new Wow('World')
  wow.say()
}

window.addEventListener('load', init)
