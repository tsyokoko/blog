> 本文授权转载自 ： https://ken.io/note/sso-design-implement 作者：ken.io
>
> 相关推荐阅读：**[系统的讲解 - SSO单点登录](https://www.imooc.com/article/286710)**

## 一、前言

### 1、SSO说明

SSO英文全称Single Sign On，单点登录。SSO是在多个应用系统中，用户只需要登录一次就可以访问所有相互信任的应用系统。https://baike.baidu.com/item/SSO/3451380

例如访问在网易账号中心（https://reg.163.com/ ）登录之后
访问以下站点都是登录状态

- 网易直播 [https://v.163.com](https://v.163.com/)
- 网易博客 [https://blog.163.com](https://blog.163.com/)
- 网易花田 [https://love.163.com](https://love.163.com/)
- 网易考拉 [https://www.kaola.com](https://www.kaola.com/)
- 网易Lofter [http://www.lofter.com](http://www.lofter.com/)

### 2、单点登录系统的好处

1. **用户角度** :用户能够做到一次登录多次使用，无需记录多套用户名和密码，省心。
1. **系统管理员角度** : 管理员只需维护好一个统一的账号中心就可以了，方便。
1. **新系统开发角度:** 新系统开发时只需直接对接统一的账号中心即可，简化开发流程，省时。

### 3、设计目标

本篇文章也主要是为了探讨如何设计&实现一个SSO系统。

以下为需要实现的核心功能：

- 单点登录
- 单点登出
- 支持跨域单点登录
- 支持跨域单点登出

## 二、SSO设计与实现

### 1、核心应用与依赖

![单点登录（SSO）设计](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/sso-system.png-kblb.png)

| 应用/模块/对象   | 说明                                |
| ---------------- | ----------------------------------- |
| 前台站点         | 需要登录的站点                      |
| SSO站点-登录     | 提供登录的页面                      |
| SSO站点-登出     | 提供注销登录的入口                  |
| SSO服务-登录     | 提供登录服务                        |
| SSO服务-登录状态 | 提供登录状态校验/登录信息查询的服务 |
| SSO服务-登出     | 提供用户注销登录的服务              |
| 数据库           | 存储用户账户信息                    |
| 缓存             | 存储用户的登录信息，通常使用Redis   |

### 2、用户登录状态的存储与校验

常见的Web框架对于[Session](https://ken.io/note/session-principle-skill)的实现都是生成一个SessionId存储在浏览器Cookie中。然后将Session内容存储在服务器端内存中，这个 ken.io 在之前[Session工作原理](https://ken.io/note/session-principle-skill)中也提到过。整体也是借鉴这个思路。
用户登录成功之后，生成AuthToken交给客户端保存。如果是浏览器，就保存在Cookie中。如果是手机App就保存在App本地缓存中。本篇主要探讨基于Web站点的SSO。
用户在浏览需要登录的页面时，客户端将AuthToken提交给SSO服务校验登录状态/获取用户登录信息

对于登录信息的存储，建议采用Redis，使用Redis集群来存储登录信息，既可以保证高可用，又可以线性扩充。同时也可以让SSO服务满足负载均衡/可伸缩的需求。

| 对象      | 说明                                                         |
| --------- | ------------------------------------------------------------ |
| AuthToken | 直接使用UUID/GUID即可，如果有验证AuthToken合法性需求，可以将UserName+时间戳加密生成，服务端解密之后验证合法性 |
| 登录信息  | 通常是将UserId，UserName缓存起来                             |

### 3、用户登录/登录校验

- 登录时序图

![SSO系统设计-登录时序图](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/sso-login-sequence.png-kbrb.png)

按照上图，用户登录后Authtoken保存在Cookie中。 domian= test. com
浏览器会将domain设置成 .test.com，
这样访问所有*.test.com的web站点，都会将Authtoken携带到服务器端。
然后通过SSO服务，完成对用户状态的校验/用户登录信息的获取

- 登录信息获取/登录状态校验

![SSO系统设计-登录信息获取/登录状态校验](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/sso-logincheck-sequence.png-kbrb.png)

### 4、用户登出

用户登出时要做的事情很简单：

1. 服务端清除缓存（Redis）中的登录状态
1. 客户端清除存储的AuthToken

- 登出时序图

![SSO系统设计-用户登出](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/sso-logout-sequence.png-kbrb.png)

### 5、跨域登录、登出

前面提到过，核心思路是客户端存储AuthToken，服务器端通过Redis存储登录信息。由于客户端是将AuthToken存储在Cookie中的。所以跨域要解决的问题，就是如何解决Cookie的跨域读写问题。

> **Cookie是不能跨域的** ，比如我一个

解决跨域的核心思路就是：

- 登录完成之后通过回调的方式，将AuthToken传递给主域名之外的站点，该站点自行将AuthToken保存在当前域下的Cookie中。
- 登出完成之后通过回调的方式，调用非主域名站点的登出页面，完成设置Cookie中的AuthToken过期的操作。
- 跨域登录（主域名已登录）

![SSO系统设计-跨域登录（主域名已登录）](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/sso-crossdomain-login-loggedin-sequence.png-kbrb.png)

- 跨域登录（主域名未登录）

![SSO系统设计-跨域登录（主域名未登录）](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/sso-crossdomain-login-unlogin-sequence.png-kbrb.png)

- 跨域登出

![SSO系统设计-跨域登出](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/sso-crossdomain-logout-sequence.png-kbrb.png)

## 三、备注

- 关于方案

这次设计方案更多是提供实现思路。如果涉及到APP用户登录等情况，在访问SSO服务时，增加对APP的签名验证就好了。当然，如果有无线网关，验证签名不是问题。

- 关于时序图

时序图中并没有包含所有场景，ken.io只列举了核心/主要场景，另外对于一些不影响理解思路的消息能省就省了。

## 四.单点登录SSO实现

- **概念**

  > 单点登录（Single Sign On），简称为 SSO，是比较流行的企业业务整合的解决方案之一。SSO的定义是在多个应用系统中，用户只需要登录一次就可以访问所有相互信任的应用系统。

  ## **背景**

  企业发展初期，系统设计不多，可能只有一个系统就可以满足业务需求，用户也只需要用账号和密码登录即可完成认证。但是随着业务的迭代发展，系统架构会随之迭代，演变越来越多的子系统，用户每进入一个系统可能都需要登录一次，才能进行相关操作。为解决此问题，便产生了单点登录，即在一个多系统共存的环境下，用户在一处登录后，就不用在其他系统中登录，就得到其他所有系统的信任。

  ![img](/Users/mbpzy/images/v2-5e2e2c97c986170943e642cd65b7fa63_1440w-3782983.jpg)

  ## **单系统登录**

  访问一个需要登录的应用时主要发生的一系列流程，如下图所示

  ![img](/Users/mbpzy/images/v2-e9fc6216cbdcf16c3132405daf895f46_1440w-3782983.jpg)

  登录后设置的 Cookie，之后每次访问时都会携带该 Cookie，服务端会根据这个Cookie找到对应的session，通过session来判断这个用户是否登录。如果不做特殊配置，这个Cookie的名字叫做`sessionid`，值在服务端（server）是唯一的，也可以设置一个`token`，作为用户唯一标识，从而让后台服务能识别当前登录用户。Cookie过期重新登录，如果是同域下系统登录，依旧可以使用此方式进行登录。

  ## **设计与实现**

  单点登录的本质就是在多个应用系统中共享登录状态。

  如果用户的登录状态是记录在 Session 中的，要实现共享登录状态，就要先共享 Session，比如可以将 Session 序列化到 Redis 中，让多个应用系统共享同一个 Redis，直接读取 Redis 来获取 Session。当然仅此是不够的，因为不同的应用系统有着不同的域名，尽管 Session 共享了，但是由于 Session ID 是往往保存在浏览器 Cookie 中的，因此存在作用域的限制，无法跨域名传递，也就是说当用户在 [http://app1.com](https://link.zhihu.com/?target=http%3A//app1.com) 中登录后，Session ID 仅在浏览器访问 [http://app1.com](https://link.zhihu.com/?target=http%3A//app1.com) 时才会自动在请求头中携带，而当浏览器访问 [http://app2.com](https://link.zhihu.com/?target=http%3A//app2.com) 时，Session ID 是不会被带过去的。**「实现单点登录的关键在于，如何让 Session ID（或 Token）在多个域中共享。」**

  ## **基于COOKIE实现**

  ### **同域名**

  一个企业一般情况下只有一个域名，通过二级域名区分不同的系统。比如我们有个域名叫做：[http://a.com](https://link.zhihu.com/?target=http%3A//a.com)，同时有两个业务系统分别为：[http://app1.a.com](https://link.zhihu.com/?target=http%3A//app1.a.com)和[http://app2.a.com](https://link.zhihu.com/?target=http%3A//app2.a.com)。我们要做单点登录（SSO），需要一个登录系统，叫做：[http://sso.a.com](https://link.zhihu.com/?target=http%3A//sso.a.com)。

  我们只要在[http://sso.a.com](https://link.zhihu.com/?target=http%3A//sso.a.com)登录，[http://app1.a.com](https://link.zhihu.com/?target=http%3A//app1.a.com)和[http://app2.a.com](https://link.zhihu.com/?target=http%3A//app2.a.com)就也登录了。通过上面的登陆认证机制，我们可以知道，在[http://sso.a.com](https://link.zhihu.com/?target=http%3A//sso.a.com)中登录了，其实是在[http://sso.a.com](https://link.zhihu.com/?target=http%3A//sso.a.com)的服务端的session中记录了登录状态，同时在浏览器端（Browser）的[http://sso.a.com](https://link.zhihu.com/?target=http%3A//sso.a.com)下写入了Cookie。那么我们怎么才能让[http://app1.a.com](https://link.zhihu.com/?target=http%3A//app1.a.com)和[http://app2.a.com](https://link.zhihu.com/?target=http%3A//app2.a.com)登录呢？

  Cookie是不能跨域的，我们Cookie的domain属性是[http://sso.a.com](https://link.zhihu.com/?target=http%3A//sso.a.com)，在给[http://app1.a.com](https://link.zhihu.com/?target=http%3A//app1.a.com)和[http://app2.a.com](https://link.zhihu.com/?target=http%3A//app2.a.com)发送请求是带不上的。sso登录以后，可以将Cookie的域设置为顶域，即.[http://a.com](https://link.zhihu.com/?target=http%3A//a.com)，这样所有子域的系统都可以访问到顶域的Cookie。

  **「我们在设置Cookie时，只能设置顶域和自己的域，不能设置其他的域。比如：我们不能在自己的系统中给[http://baidu.com](https://link.zhihu.com/?target=http%3A//baidu.com)的域设置Cookie。」**

  ![img](/Users/mbpzy/images/v2-0037e5118c364030b22a97c64c5c425f_1440w-3782983.jpg)

  总结：此种实现方式比较简单，但不支持跨主域名。

  ### **不同域名**

  上面列举的例子是针对相同域名，但是当顶级域名不相同的时候，如天猫和淘宝，如何实现cookie共享呢？

  ### **nginx反向代理**

  **「反向代理（Reverse Proxy」**方式是指以代理服务器来接受Internet上的连接请求，然后将请求转发给内部网络上的服务器；并将从服务器上得到的结果返回给Internet上请求连接的客户端，此时代理服务器对外就表现为一个服务器。

  反向代理服务器对于客户端而言它就像是原始服务器，并且客户端不需要进行任何特别的设置。客户端向反向代理的命名空间(name-space)中的内容发送普通请求，接着反向代理将判断向何处(原始服务器)转交请求，并将获得的内容返回给客户端，就像这些内容 原本就是它自己的一样。

  nginx配置如下：

  ```nginx
  upstream web1{
  		server  127.0.0.1:8089  max_fails=0 weight=1;
  }
  upstream web2 {
   		server 127.0.0.1:8080    max_fails=0 weight=1;
  }
  
  location /web1 {
  		proxy_pass http://web1;
    	proxy_set_header Host  127.0.0.1;
    	proxy_set_header   X-Real-IP        $remote_addr;
    	proxy_set_header   X-Forwarded-For  $proxy_add_x_forwarded_for;
  
    	proxy_set_header Cookie $http_cookie;
    	log_subrequest on;
  }
  
  location /web2 {
    	proxy_pass http://web2;
    	proxy_set_header Host  127.0.0.1;
    	proxy_set_header   X-Real-IP        $remote_addr;
    	proxy_set_header   X-Forwarded-For  $proxy_add_x_forwarded_for;
    	proxy_set_header Cookie $http_cookie;
    	log_subrequest on;
  }
  ```

  ### **其它方式**

  除了nginx反向代理，还有`jsonp`等方式都可以实现cookie共享，达到单点登录的目的。

  ## **认证中心**

  基于cookie方式实现单点登录，存在安全隐患，另外可能还要解决跨域问题，对于此，可以部署一个**「认证中心」**，认证中心就是一个专门负责处理登录请求的独立的 Web 服务。

  只有认证中心能接受用户的用户名密码等安全信息，其他系统不提供登录入口，只接受认证中心的间接授权。间接授权通过令牌实现，sso认证中心验证用户的用户名密码没问题，创建授权令牌，在接下来的跳转过程中，授权令牌作为参数发送给各个子系统，子系统拿到令牌，即得到了授权，可以借此创建局部会话，局部会话登录方式与单系统的登录方式相同。

  ![img](/Users/mbpzy/images/v2-e132e032f1ba68f438d607dc0448a76f_1440w-3782983.jpg)

  下面对上图简要描述

  1. 用户访问系统1的受保护资源，系统1发现用户未登录，跳转至sso认证中心，并将自己的地址作为参数
  1. sso认证中心发现用户未登录，将用户引导至登录页面
  1. 用户输入用户名密码提交登录申请
  1. sso认证中心校验用户信息，创建用户与sso认证中心之间的会话，称为**全局会话**，同时创建**授权令牌**
  1. sso认证中心带着令牌重定向最初的请求地址（系统1）
  1. 系统1拿到令牌，去sso认证中心校验令牌是否有效
  1. sso认证中心校验令牌，返回有效，注册系统1
  1. 系统1使用该令牌创建与用户的会话，key为用户字段，值为token，称为局部会话，返回受保护资源
  1. 用户访问系统2的受保护资源
  1. 系统2发现用户未登录，重定向sso认证中心，并将自己的地址作为参数
  1. sso认证中心发现用户已登录，跳转回系统2的地址，并附上令牌
  1. 系统2拿到令牌，去sso认证中心校验令牌是否有效
  1. sso认证中心校验令牌，返回有效，注册系统2
  1. 系统2使用该令牌创建与用户的局部会话，返回受保护资源

  **用户登录成功之后，会与sso认证中心及各个子系统建立会话，用户与sso认证中心建立的会话称为全局会话，用户与各个子系统建立的会话称为局部会话，局部会话建立之后，用户访问子系统受保护资源将不再通过sso认证中心**，全局会话与局部会话有如下约束关系

  1. 局部会话存在，全局会话一定存在
  1. 全局会话存在，局部会话不一定存在
  1. 全局会话销毁，局部会话必须销毁

  ## **小结**

  单点登录的设计，让用户用户不再被多次登录困扰，也不需要记住多个 ID 和密码。另外，用户忘记密码并求助于支持人员的情况也会减少，同时也会减少管理用户帐号的负担。