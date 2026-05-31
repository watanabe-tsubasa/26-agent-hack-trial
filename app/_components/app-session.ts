export type AppSession =
  | {
      role: "site_user";
      siteKey: string;
      siteName: string;
      facilityId: string;
      locationKey: string;
    }
  | {
      role: "admin";
      siteName: string;
    };
