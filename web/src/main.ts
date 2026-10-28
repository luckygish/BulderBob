import './styles.css'
import './bureau.css'
import { App } from './ui/app'

const root = document.querySelector<HTMLElement>('#app')
if (!root) throw new Error('Корневой элемент приложения не найден')

new App(root).start()
