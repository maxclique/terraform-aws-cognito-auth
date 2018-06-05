/*
 * Copyright (c) 2018 Martin Donath <martin.donath@squidfunk.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

import { AuthenticationClient } from "~/clients/authentication"

import { chance } from "_/helpers"
import {
  mockAuthenticateRequestWithCredentials,
  mockAuthenticateRequestWithToken
} from "_/mocks/handlers/authenticate"
import { mockRegisterRequest } from "_/mocks/handlers/register"
import { mockResetRequest } from "_/mocks/handlers/reset"
import {
  mockCognitoIDPAdminGetUserWithError,
  mockCognitoIDPAdminGetUserWithResult,
  mockCognitoIDPInitiateAuthWithChallenge,
  mockCognitoIDPInitiateAuthWithCredentials,
  mockCognitoIDPInitiateAuthWithError,
  mockCognitoIDPInitiateAuthWithToken,
  mockCognitoIDPSignUpWithError,
  mockCognitoIDPSignUpWithSuccess
} from "_/mocks/vendor/aws-sdk"
import {
  mockVerificationCode,
  mockVerificationIssueWithError,
  mockVerificationIssueWithResult
} from "_/mocks/verification"

/* ----------------------------------------------------------------------------
 * Tests
 * ------------------------------------------------------------------------- */

/* Authentication client */
describe("clients/authentication", () => {

  /* AuthenticationClient */
  describe("AuthenticationClient", () => {

    /* #register */
    describe("#register", () => {

      /* Registration request and verification code */
      const { email, password } = mockRegisterRequest()
      const code = mockVerificationCode()

      /* Test: should resolve with verification code */
      it("should resolve with verification code", async () => {
        mockCognitoIDPSignUpWithSuccess()
        mockVerificationIssueWithResult(code)
        const auth = new AuthenticationClient()
        expect(await auth.register(email, password))
          .toEqual(code)
      })

      /* Test: should set username to random uuid */
      it("should set username to random uuid", async () => {
        const signUpMock = mockCognitoIDPSignUpWithSuccess()
        mockVerificationIssueWithResult()
        const auth = new AuthenticationClient()
        await auth.register(email, password)
        expect(signUpMock).toHaveBeenCalledWith(
          jasmine.objectContaining({
            Username: jasmine.stringMatching(
              /^[\w]{8}-[\w]{4}-[\w]{4}-[\w]{4}-[\w]{12}$/
            )
          }))
      })

      /* Test: should set password */
      it("should set password", async () => {
        const signUpMock = mockCognitoIDPSignUpWithSuccess()
        mockVerificationIssueWithResult()
        const auth = new AuthenticationClient()
        await auth.register(email, password)
        expect(signUpMock).toHaveBeenCalledWith(
          jasmine.objectContaining({
            Password: password
          }))
      })

      /* Test: should set email as attribute */
      it("should set email as attribute", async () => {
        const signUpMock = mockCognitoIDPSignUpWithSuccess()
        mockVerificationIssueWithResult()
        const auth = new AuthenticationClient()
        await auth.register(email, password)
        expect(signUpMock).toHaveBeenCalledWith(
          jasmine.objectContaining({
            UserAttributes: jasmine.arrayContaining([
              {
                Name: "email",
                Value: email
              }
            ])
          }))
      })

      /* Test: should reject on verification error */
      it ("should reject on verification error", async done => {
        const errMock = new Error()
        mockCognitoIDPSignUpWithSuccess()
        const issueMock = mockVerificationIssueWithError(errMock)
        try {
          const auth = new AuthenticationClient()
          await auth.register(email, password)
          done.fail()
        } catch (err) {
          expect(issueMock).toHaveBeenCalled()
          expect(err).toBe(errMock)
          done()
        }
      })

      /* Test: should reject on AWS Cognito IDP error */
      it ("should reject on AWS Cognito IDP error", async done => {
        const errMock = new Error()
        const signUpMock = mockCognitoIDPSignUpWithError(errMock)
        mockVerificationIssueWithResult()
        try {
          const auth = new AuthenticationClient()
          await auth.register(email, password)
          done.fail()
        } catch (err) {
          expect(signUpMock).toHaveBeenCalled()
          expect(err).toBe(errMock)
          done()
        }
      })
    })

    /* #authenticate */
    describe("#authenticate", () => {

      /* Authentication requests */
      const { username, password } = mockAuthenticateRequestWithCredentials()
      const { token } = mockAuthenticateRequestWithToken()

      /* Test: should resolve with access token for valid credentials */
      it("should resolve with access token for valid credentials",
        async () => {
          mockCognitoIDPInitiateAuthWithCredentials()
          const auth = new AuthenticationClient()
          const { access } = await auth.authenticate(username, password)
          expect(access.token).toEqual(jasmine.any(String))
          expect(Date.parse(access.expires))
            .toBeGreaterThan(Date.now() + 1000 * 59 * 60)
        })

      /* Test: should resolve with refresh token for valid credentials */
      it("should resolve with refresh token for valid credentials",
        async () => {
          mockCognitoIDPInitiateAuthWithCredentials()
          const auth = new AuthenticationClient()
          const { refresh } = await auth.authenticate(username, password)
          expect(refresh!.token).toEqual(jasmine.any(String))
          expect(Date.parse(refresh!.expires))
            .toBeGreaterThan(Date.now() + 1000 * 59 * 60 * 24 * 30)
        })

      /* Test: should resolve with access token for valid refresh token */
      it("should resolve with access token for valid refresh token",
        async () => {
          mockCognitoIDPInitiateAuthWithToken()
          const auth = new AuthenticationClient()
          const { access, refresh } = await auth.authenticate(token)
          expect(access.token).toEqual(jasmine.any(String))
          expect(Date.parse(access.expires))
            .toBeGreaterThan(Date.now() + 1000 * 59 * 60)
          expect(refresh).toBeUndefined()
        })

      /* Test: should reject on challenge for valid credentials */
      it("should reject on challenge for valid credentials",
        async done => {
          const challenge = chance.string()
          const initiateAuthMock =
            mockCognitoIDPInitiateAuthWithChallenge(challenge)
          try {
            const auth = new AuthenticationClient()
            await auth.authenticate(username, password)
            done.fail()
          } catch (err) {
            expect(initiateAuthMock).toHaveBeenCalled()
            expect(err).toEqual(
              new Error(`Invalid authentication: challenge "${challenge}"`))
            done()
          }
        })

      /* Test: should reject on challenge for valid refresh token */
      it("should reject on challenge for valid refresh token",
        async done => {
          const challenge = chance.string()
          const initiateAuthMock =
            mockCognitoIDPInitiateAuthWithChallenge(challenge)
          try {
            const auth = new AuthenticationClient()
            await auth.authenticate(token)
            done.fail()
          } catch (err) {
            expect(initiateAuthMock).toHaveBeenCalled()
            expect(err).toEqual(
              new Error(`Invalid authentication: challenge "${challenge}"`))
            done()
          }
        })

      /* Test: should reject on AWS Cognito IDP error for credentials */
      it("should reject on AWS Cognito IDP error for credentials",
        async done => {
          const errMock = new Error()
          const initiateAuthMock =
            mockCognitoIDPInitiateAuthWithError(errMock)
          try {
            const auth = new AuthenticationClient()
            await auth.authenticate(username, password)
            done.fail()
          } catch (err) {
            expect(initiateAuthMock).toHaveBeenCalled()
            expect(err).toBe(errMock)
            done()
          }
        })

      /* Test: should reject on AWS Cognito IDP error for token */
      it("should reject on AWS Cognito IDP error for token",
        async done => {
          const errMock = new Error()
          const initiateAuthMock =
            mockCognitoIDPInitiateAuthWithError(errMock)
          try {
            const auth = new AuthenticationClient()
            await auth.authenticate(token)
            done.fail()
          } catch (err) {
            expect(initiateAuthMock).toHaveBeenCalled()
            expect(err).toBe(errMock)
            done()
          }
        })
    })

    /* #forgotPassword */
    describe("#forgotPassword", () => {

      /* Reset requests and verification code */
      const { username } = mockResetRequest()
      const code = mockVerificationCode()

      /* Test: should resolve with verification code */
      it("should resolve with verification code", async () => {
        mockCognitoIDPAdminGetUserWithResult()
        mockVerificationIssueWithResult(code)
        const auth = new AuthenticationClient()
        expect(await auth.forgotPassword(username))
          .toEqual(code)
      })

      /* Test: should reject on verification error */
      it ("should reject on verification error", async done => {
        const errMock = new Error()
        mockCognitoIDPAdminGetUserWithResult()
        const issueMock = mockVerificationIssueWithError(errMock)
        try {
          const auth = new AuthenticationClient()
          await auth.forgotPassword(username)
          done.fail()
        } catch (err) {
          expect(issueMock).toHaveBeenCalled()
          expect(err).toBe(errMock)
          done()
        }
      })

      /* Test: should reject on AWS Cognito IDP error */
      it ("should reject on AWS Cognito IDP error", async done => {
        const errMock = new Error()
        const adminGetUserMock = mockCognitoIDPAdminGetUserWithError(errMock)
        mockVerificationIssueWithResult()
        try {
          const auth = new AuthenticationClient()
          await auth.forgotPassword(username)
          done.fail()
        } catch (err) {
          expect(adminGetUserMock).toHaveBeenCalled()
          expect(err).toBe(errMock)
          done()
        }
      })
    })
  })
})
