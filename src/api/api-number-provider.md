Get/Occupy phone number
https://api.durianrcs.com/out/ext_api/getMobile?name=admin&ApiKey=12345678&cuy=bo&pid=123&num=5&noblack=0&serial=2&secret_key=null&vip=null

Friendly reminder: It is strongly recommended to wait for 5 seconds and then send SMS after you got the phone number.
name：username*
ApiKey：API interface authentication token* show
cuy：country code (two digits, not required, by default all countries) show
pex：Filter the number prefix. Format: 591738, country code (591, refer to cuy country code) + prefix (738), total length: 1-6 digits
pid：project ID*
num：Get the number of mobile phone numbers quantity (1-10)*
noblack：Filter blacklists rule (0, 1) : 0: Filter only self-added blacklists, 1: filter all user-added blacklists*
serial：Single or multiple (1: multiple, 2: single)*
secret_key：parameters required only for few special projects, please contact admin if you get a reminder that it is required, otherwise just leave it empty*
vip：VIP exclusive channel*
//Single data format
{
"code": 200,
"msg": "Success",
"data": "+59173841704"
}
//Multiple data formats
{
"code": 200,
"msg": "Success",
"data": [
"+59173841704",
"+59173841704"
]
}

//return value reference
200：Success
800：Account is blocked
802：incorrect username or ApiKey
803：Username or ApiKey cannot be empty
902：Incorrect parameter
903：invalid country code
904：Invalid project ID
906：number list is empty
907：Vipkey error
400：Failure, system exception
403：Insufficient credits balance, please recharge to continue
406：New numbers obtained in 24 hours has reached the maximum amount. Please contact administrator to upgrade your account level to increase new numbers access or continue to get old numbers
409：The request frequency is too high, please check your code or contact the administrator
400101：This project requires secret key, please contact the administrator
400102：The parameters specified are not open, please contact the administrator
400103：secret\_ Key error
400906：Invalid series or series parameter error
200408：The phone numbers cards amount has reached the upper limit, please contact the administrator to increase more numbers

Get verification code
https://api.durianrcs.com/out/ext_api/getMsg?name=admin&ApiKey=12345678&pn=+59173841704&pid=123&serial=2
name：username*
ApiKey：API interface authentication token* show
pid：project ID*
pn：phone number*
serial：Single or multiple (1: multiple, 2: single)\*
//Single data format
{
"code": 200,
"msg": "Success",
"data": "123456"
}
//Multiple data formats
{
"code": 407,
"msg": "Access to all SMS, API requests refresh and retry",
"data": "Project name:123456;Project name:123456;"
}

//return value reference
200：Success
800：Account is blocked
802：incorrect username or ApiKey
803：Username or ApiKey cannot be empty
904：Invalid project ID
905：Invalid number
908：SMS not found. Please try again later
405：Failed to receive SMS. Please check the Message Record or contact the administrator
407：Access to all SMS, API requests refresh and retry
400906：Invalid series or series parameter error

Note: the serial parameter must be the same as the serial parameter when obtaining the mobile phone number,
otherwise 405 will be returned if no information is obtained

Query phone number status
https://api.durianrcs.com/out/ext_api/getStatus?name=admin&ApiKey=12345678&pn=+59173841704&pid=123
name：username*
ApiKey：API interface authentication token* show
pid：project ID*
pn：phone number*
{
"code": 203,
"msg": "The number is not occupied and no SMS is received",
"data": ""
}

//return value reference
200：Success
800：Account is blocked
802：incorrect username or ApiKey
803：Username or ApiKey cannot be empty
904：Invalid project ID
905：Invalid number
201：SMS received successfully
202：Number is occupied, SMS not received
203：Number is not occupied, SMS not received

. Query whether the phone number is added to blacklist
https://api.durianrcs.com/out/ext_api/getBlack?name=xxxx&ApiKey=12345678&pn=+59173841704&pid=xx
name：username*
ApiKey：API interface authentication token* show
pid：project ID*
pn：phone number*
{
"code": 200100,
"msg": "Blacklist added successfully",
"data": ""
}

//return value reference
200100：List has been added successfully
800：Account is blocked
802：incorrect username or ApiKey
803：Username or ApiKey cannot be empty
904：Invalid project ID
905：Invalid number
902： Incorrect parameter
400100：The number is not added to the blacklist

Query the country distribution and quantity of the current online numbers
https://api.durianrcs.com/out/ext_api/getCountryPhoneNum?name=admin&ApiKey=12345678&pid=null&vip=null
name：username*
ApiKey：API interface authentication token* show
pid：ID of the corresponding item*
vip：VIP exclusive channel*
{
"code":200,
"msg":"Success",
"data":{
"th":2,
"id":1,
"in":1
}
}
//return value reference
200：Success
403: no data
800：Account is blocked
802：incorrect username or ApiKey
803：Username or ApiKey cannot be empty
907：Vipkey error
