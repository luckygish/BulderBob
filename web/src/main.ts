import './styles.css'
import './bureau.css'
import { App } from './ui/app'

const root = document.querySelector<HTMLElement>('#app')
if (!root) throw new Error('Application root element not found')

new App(root).start()
