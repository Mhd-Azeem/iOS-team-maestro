import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',testMatch:'**/*.spec.ts',use:{baseURL:'http://127.0.0.1:18471',headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined},webServer:{command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 18471 --strictPort',url:'http://127.0.0.1:18471',reuseExistingServer:false},workers:1});


