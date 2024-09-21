---
title: Try Tauri 
description: In this article, we’ll explore Tauri and use it for a simple Webview app.
date: 2022-12-08 16:42:57
tags:
  - tauri
  - rust
  - macos
---

<div class="message-box">
 <p>Tauri is a polyglot and generic toolkit that is very composable and allows engineers to make a wide variety of applications.  It is used for building applications for desktop computers using a combination of Rust tools and HTML rendered in a Webview.</p>
</div>

Sounds interesting and I decided to give it a try, and make a simple application for tracking cryptocurrency tickers from the Binance exchange.

# Setup

The first step is to install and create an application template.
We need [rust](https://www.rust-lang.org/tools/install) and `cargo` in order to generate our application scaffold (there are many other options for generation but since I'm starting to learn `rust` I will stick with it.)

The easiest way to scaffold a new project is the `create-tauri-app` utility.

```shell
cargo install create-tauri-app
cargo create-tauri-app 
✔ Project name · mycryptobar
? Choose your package manager ›
  cargo
❯ pnpm
  yarn
  npm
```
On this step generator asking us about prefer package manager for our frontend, there are two options: 
* for handling frontend with `rust` trough [yew](https://yew.rs/) chose `cargo`
* for handle frontend with `js` trough any modern js framework like `vue`, `svelte`, `react` and so on choose `pnpm`, `yarn`, `npm`.

In my example I'll use `pnpm` as package manager, [solidjs](https://www.solidjs.com/) and [tailwind framework](https://tailwindcss.com/).

# Scaffold
Generator create an application scaffold for us, there are two part `frontend` in our root folder and `backend` in `src-tauri` folder.
We will create system tray application and we need enable it in the `src-tauri/Cargo.toml`:

```git
diff --git a/src-tauri/Cargo.toml b/src-tauri/Cargo.toml
index f05fce3..6434503 100644
--- a/src-tauri/Cargo.toml
+++ b/src-tauri/Cargo.toml
@@ -16,6 +16,7 @@ tauri-build = {version = "1.2", features = [] }
 [dependencies]
 serde_json = "1.0"
 serde = { version = "1.0", features = ["derive"] }
+tauri = { version = "1.2.1", features = ["http-request", "icon-png", "system-tray"] }
 
 [features]
 # by default Tauri runs in production mode
```

Add tray configuration to `src-tauri/tauri.conf.json`:

```git
diff --git a/src-tauri/src/main.rs b/src-tauri/src/main.rs
index e27813a..af057f4 100644
--- a/src-tauri/src/main.rs
+++ b/src-tauri/src/main.rs
@@ -3,6 +3,9 @@
     windows_subsystem = "windows"
 )]
 
+use tauri::SystemTray;
+use tauri::{CustomMenuItem, SystemTrayMenu, SystemTrayMenuItem};
+
 // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
 #[tauri::command]
 fn greet(name: &str) -> String {
@@ -10,7 +13,17 @@ fn greet(name: &str) -> String {
 }
 
 fn main() {
+    let quit = CustomMenuItem::new("quit".to_string(), "Quit");
+    let hide = CustomMenuItem::new("hide".to_string(), "Hide");
+    let tray_menu = SystemTrayMenu::new()
+        .add_item(quit)
+        .add_native_item(SystemTrayMenuItem::Separator)
+        .add_item(hide);
+
+    let system_tray = SystemTray::new()
+    .with_menu(tray_menu);
     tauri::Builder::default()
+        .system_tray(system_tray)
         .invoke_handler(tauri::generate_handler![greet])
         .run(tauri::generate_context!())
         .expect("error while running tauri application");
diff --git a/src-tauri/tauri.conf.json b/src-tauri/tauri.conf.json
index eaac219..0dbc746 100644
--- a/src-tauri/tauri.conf.json
+++ b/src-tauri/tauri.conf.json
@@ -52,6 +52,10 @@
     },
     "updater": {
       "active": false
+    },
+     "systemTray": {
+      "iconPath": "icons/icon.png",
+      "iconAsTemplate": true
     },
     "windows": [
```

Now lets test it, run `cargo tauri dev`:

{% image "./tauri-tray.png", "MacOS tauri example", [600] %}

# Frontend

Lets add some frontend code, first part with styles.
Install and generate tailwind our css framework:

```bash
pnpm install -D tailwindcss postcss autoprefixer
pnpm tailwindcss init -p
cat tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

A little bit css code for tailwind components `src/style.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Next step add solidjs code for out frontend, in `src/App.jsx`, in this code we create a simple table component to render the response from binance exchange:

```js
import { invoke } from "@tauri-apps/api/tauri";
import Item from "./Item";
import { createSignal, createEffect } from "solid-js";

const timeTicker = 10;

function App() {
  const [count, setCount] = createSignal(timeTicker);
  const [items, setItems] = createSignal([]);

  createEffect(() => {
    const c = count()
    setTimeout(async () => {
      if (c === 0) {
        const response = await invoke("get_binance_ticker")
        setItems(response, { equals: false })
        setCount(timeTicker)
        return
      }
      setCount(c - 1);
    }, 1000);
  })

  return (
    <div class="grid grid-rows-2 grid-flow-row font-source h-screen bg-background p-1">
      <div class="font-light">
        <div class="grid grid-cols-4 gap-4 h-4 content-center text-xs  text-slate-400">
          <div class="col-span-2">Pair</div>
          <div class="ml-auto">Price</div>
          <div class="ml-auto">24h%</div>
        </div>
        <For each={items()}>
          {(item) => <Item symbol={item.symbol} priceChangePercent={item.change} lastPrice={item.price}/>}
        </For>
      </div>
      <div class="text-xs font-light text-slate-400">
      </div>
      <div class="text-xs font-light text-slate-400 ml-auto">
          <div class="col-span-2">Updating in: {count()}</div>
      </div>
    </div>
  );
}

export default App;
```

Create a table item component `src/Item.jsx`

```js
const buttonClass = "text-white font-bold uppercase shadow hover:shadow-md outline-none focus:outline-none ease-linear transition-all duration-150 px-2"
const greenButton = "bg-green-500 "
const redButton = "bg-red-500 "

export default function Item (props) {
    return <div class="grid grid-cols-4 gap-4 text-base h-6 content-center text-slate-700">
        <div class="col-span-2"><div>{props.symbol}</div></div>
        <div class="ml-auto"><div>{props.lastPrice}</div></div>
        <div class="ml-auto"><div class={(props.priceChangePercent.startsWith("-") ? redButton : greenButton) + buttonClass}>{props.priceChangePercent}%</div></div>
    </div>
}
```

# Backend

Now the magic part is to call our `rust` backend and fetch the prices from exchange, tauri provide [a helper function](https://tauri.app/v1/guides/features/command) for this case `invoke`, install that helper:

```shell
pnpm add @tauri-apps/api
```

Add to our frontend code `src/App.jsx`:

```js
import { invoke } from "@tauri-apps/api/tauri";
// some code here
const response = await invoke("get_binance_ticker")
// some code here
```

And the `rust` part, firstly add library to make http calls `src-tauri/Cargo.toml`:

```yaml
...
reqwest = { version = "0.11.13", features = ["blocking", "json"] }
...
```

Next add to `rust` code a tauri command `get_binance_ticker` which returns the response from binance exchange, in our frontend code we have `invoke("get_binance_ticker")` function call.

`src-tauri/src/main.rs`:

```rust
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]
use reqwest::Url;
use serde::{Deserialize, Serialize};
use tauri::{CustomMenuItem, Manager, SystemTray, SystemTrayEvent, SystemTrayMenu};

#[derive(Serialize, Deserialize, Debug)]
struct ApiResponse {
    symbol: String,
    #[serde(rename(deserialize = "lastPrice"))]
    price: String,
    #[serde(rename(deserialize = "priceChangePercent"))]
    change: String,
}

#[tauri::command]
fn get_binance_ticker() -> Vec<ApiResponse> {
    let url = "https://api.binance.com/api/v1/ticker/24hr?symbols=[%22BTCUSDT%22,%22BNBUSDT%22,%22ETHUSDT%22,%22XRPUSDT%22,%22DOGEUSDT%22,%22SHIBUSDT%22]";

    let url = Url::parse(&*url).unwrap();
    let res = reqwest::blocking::get(url).unwrap();
    let items: Vec<ApiResponse> = res.json().unwrap();

    println!("{:?}", items);
    items
}

#[tauri::command]
fn set_title(app_handle: tauri::AppHandle, value: &str) {
    #[cfg(target_os = "macos")]
    app_handle.tray_handle().set_title(&value).unwrap();
}

fn create_tray(app: &tauri::App) -> tauri::Result<()> {
    let tray_menu = SystemTrayMenu::new()
        .add_item(CustomMenuItem::new("clear_title", "Clear Title"))
        .add_item(CustomMenuItem::new("set_title", "Set Title"))
        .add_item(CustomMenuItem::new("quit", "Quit"));

    let handle = app.handle();
    let tray_id = "cryptobar-tray".to_string();
    SystemTray::new()
        .with_id(&tray_id)
        .with_menu(tray_menu)
        .on_event(move |event| {
            let tray_handle = handle.tray_handle_by_id(&tray_id).unwrap();
            match event {
                SystemTrayEvent::LeftClick {
                    position: _,
                    size: _,
                    ..
                } => {
                    println!("left click")
                }
                SystemTrayEvent::MenuItemClick { id, .. } => {
                    // let item_handle = tray_handle.get_item(&id);
                    println!("menu click");
                    match id.as_str() {
                        "quit" => {
                            // exit the app
                            handle.exit(0);
                        }
                        "clear_title" => {
                            #[cfg(target_os = "macos")]
                            tray_handle.set_title("").unwrap();
                        }
                        "set_title" => {
                            #[cfg(target_os = "macos")]
                            tray_handle.set_title("Tauri").unwrap();
                        }
                        _ => {}
                    }
                }
                _ => {}
            }
        })
        .build(app)
        .map(|_| ())
}

fn main() {
    tauri::Builder::new()
        .setup(|app| {
            create_tray(app)?;
            Ok(())
        })
        .on_system_tray_event(move |app, event| match event {
            SystemTrayEvent::LeftClick { position, size, .. } => {
                let w = app.get_window("main").unwrap();
                let visible = w.is_visible().unwrap();
                if visible {
                    w.hide().unwrap();
                } else {
                    w.show().unwrap();
                    w.set_focus().unwrap();
                }
            }
            _ => {}
        })
        .on_window_event(|event| match event.event() {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                // don't kill the app when the user clicks close. this is important
                // event.window().hide().unwrap();
                // api.prevent_close();
            }
            tauri::WindowEvent::Focused(false) => {
                // hide the window automatically when the user
                // clicks out. this is for a matter of taste.
                // event.window().hide().unwrap();
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![set_title, get_binance_ticker])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

# Overview

If all steps above was successfull now we have a very basic GUI application build with `tauri`.

{% image "./tauri-tray-2.png", "MacOS tauri example", [600] %}

You can play with tray functionalities, create [multiwindow application](https://tauri.app/v1/guides/features/multiwindow) and ship it [for many platforms](https://tauri.app/v1/guides/building/).

Happy coding!