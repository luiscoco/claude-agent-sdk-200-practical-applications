import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/browser',workers:1,timeout:240_000,
  use:{baseURL:'http://127.0.0.1:43122',viewport:{width:1920,height:1080},
    launchOptions:process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{},
    screenshot:'only-on-failure',trace:'retain-on-failure'},
  webServer:{command:'npm start',url:'http://127.0.0.1:43122',reuseExistingServer:true}
});
