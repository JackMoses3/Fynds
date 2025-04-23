import { Injectable, UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    handleRequest(err: Error | null, user: any, info: any): any {
      if (err || !user) {
        console.log('❌ Unauthorized access attempt: either token is invalid or user is missing');
        throw new UnauthorizedException('Access token is invalid or expired');
      }
      return user;
      }
}

// import {
//     ExecutionContext,
//     Injectable,
//     UnauthorizedException,
//   } from '@nestjs/common';
//   import { AuthGuard } from '@nestjs/passport';
  
//   @Injectable()
//   export class JwtAuthGuard extends AuthGuard('jwt') {
//     canActivate(context: ExecutionContext) {
//       // Add your custom authentication logic here
//       // for example, call super.logIn(request) to establish a session.
//       return super.canActivate(context);
//     }
  
//     handleRequest(err, user, info) {
//       // You can throw an exception based on either "info" or "err" arguments
//       if (err || !user) {
//         throw err || new UnauthorizedException();
//       }
//       return user;
//     }
//   }
  