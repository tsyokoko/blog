## 单点登录SSO实现

- **概念**

  > 单点登录（Single Sign On），简称为 SSO，是比较流行的企业业务整合的解决方案之一。SSO的定义是在多个应用系统中，用户只需要登录一次就可以访问所有相互信任的应用系统。

  ## **背景**

  企业发展初期，系统设计不多，可能只有一个系统就可以满足业务需求，用户也只需要用账号和密码登录即可完成认证。但是随着业务的迭代发展，系统架构会随之迭代，演变越来越多的子系统，用户每进入一个系统可能都需要登录一次，才能进行相关操作。为解决此问题，便产生了单点登录，即在一个多系统共存的环境下，用户在一处登录后，就不用在其他系统中登录，就得到其他所有系统的信任。

  ![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/v2-5e2e2c97c986170943e642cd65b7fa63_1440w.jpg)

  ## **单系统登录**

  访问一个需要登录的应用时主要发生的一系列流程，如下图所示

  ![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/v2-e9fc6216cbdcf16c3132405daf895f46_1440w.jpg)

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

  ![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/v2-0037e5118c364030b22a97c64c5c425f_1440w.jpg)

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

  ![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/v2-e132e032f1ba68f438d607dc0448a76f_1440w.jpg)

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