import NextAuth from "next-auth"

declare module "next-auth" {
  interface User {
    isAdmin?: boolean
    isActive?: boolean
  }

  interface Session {
    user: {
      id: string
      email: string
      name?: string
      isAdmin?: boolean
      isActive?: boolean
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    isAdmin?: boolean
    isActive?: boolean
  }
}