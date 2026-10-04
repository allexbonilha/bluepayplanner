import test from 'node:test';import assert from 'node:assert/strict';
import {validateAccountChange} from '../lib/user-security.ts';
test('account changes require current password and normalize the new username',()=>{
 const input={name:'Allex',username:' AllexBonilha ',currentPassword:'current-password-1234',newPassword:'',confirmation:''};
 assert.equal(validateAccountChange(input).username,'allexbonilha');
 assert.throws(()=>validateAccountChange({...input,currentPassword:''}));
 assert.throws(()=>validateAccountChange({...input,username:'invalid user'}));
});
test('optional password must be strong and confirmed and fields cannot select a different user',()=>{
 const input={name:'Allex',username:'allexbonilha',currentPassword:'current-password-1234',newPassword:'new-password-long-1234',confirmation:'new-password-long-1234',userId:'someone-else',role:'admin'};
 const result=validateAccountChange(input);assert.equal('userId' in result,false);assert.equal('role' in result,false);
 assert.throws(()=>validateAccountChange({...input,newPassword:'short',confirmation:'short'}));
 assert.throws(()=>validateAccountChange({...input,confirmation:'different'}));
});
