**一、名词解释**

**1.  Apache**

Apache HTTP服务器是一个模块化的服务器，可以运行在几乎所有广泛使用的计算机平台上，例如Linux、Unix、Windows等，属于应用服务器。

Apache支持支持模块多，性能稳定，Apache本身是静态解析，适合静态HTML、图片等，但可以通过扩展脚本、模块等支持动态页面，例如PHP、JSP等。

![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/apache-nginx-tomcat-qu-bie-09.jpeg)

Apche可以支持PHP、cgi、perl，但是要使用Java的话，你需要Tomcat在Apache后台支撑，将Java请求由Apache转发给Tomcat处理。

缺点：配置相对复杂，自身不支持动态页面，需要插件扩展来辅助支持动态页面解析，如FastCGI、Tomcat等。

 

**2. Tomcat**

Tomcat是应用（Java）服务器，它只是一个Servlet(JSP也翻译成Servlet)容器，可以认为是Apache的扩展，但是可以独立于Apache运行，Tomcat可以单独运行Java war包。

![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/apache-nginx-tomcat-qu-bie-02.jpeg)

 

**3. Nginx**

Nginx是俄罗斯人编写的十分轻量级的HTTP服务器，它的发音为“engine X”，是一个高性能的HTTP和反向代理服务器，同时也是一个IMAP/POP3/SMTP 代理服务器。

![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/apache-nginx-tomcat-qu-bie-03.jpeg)

 

**二、比较**

**1. Apache 与 Tomcat 比较**

**相同点：**

1）两者都是Apache组织开发的

2）两者都有HTTP服务的功能

3）两者都是开源、免费的

**不同点：**

1）Apache是专门用了提供HTTP服务的，以及相关配置的（例如虚拟主机、URL转发等等），而Tomcat是Apache组织在符合Java EE的JSP、Servlet标准下开发的一个JSP服务器. 

2）Apache是一个Web服务器环境程序，启用他可以作为Web服务器使用，不过只支持静态网页如(ASP、PHP,、CGI、JSP)等动态网页的就不行。如果要在Apache环境下运行JSP的话就需要一个解释器来执行JSP网页，而这个JSP解释器就是Tomcat。

3）Apache 侧重于HTTP Server，Tomcat 侧重于Servlet引擎，如果以Standalone方式运行，功能上与Apache等效，支持JSP，但对静态网页不太理想；

4）Apache是Web服务器，Tomcat是应用（Java）服务器，它只是一个Servlet(JSP也翻译成Servlet)容器，可以认为是Apache的扩展，但是可以独立于Apache运行。

 

**实际使用中Apache与Tomcat常常是整合使用：**

1）如果客户端请求的是静态页面，则只需要Apache服务器响应请求。

2）如果客户端请求动态页面，则是Tomcat服务器响应请求。

3）因为JSP是服务器端解释代码的，这样整合就可以减少Tomcat的服务开销。

可以理解 Tomcat为Apache的一种扩展**。**

 

**2. Nginx 与 Apache 比较**

![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/apache-nginx-tomcat-qu-bie-01.jpeg)

#### 1) **Nginx** 优点 

a）轻量级，同样起web 服务，比Apache**占用更少的内存及资源** 

b）**抗并发，nginx 处理请求是异步非阻塞的，而apache 则是阻塞型的**，在高并发下nginx 能保持低资源低消耗高性能 

c）高度模块化的设计，编写模块相对简单 

d）提供负载均衡，充分利用服务器资源

e）社区活跃，各种高性能模块出品迅速

 

#### 2) **Apache** 优点 

a）apache的 rewrite 比nginx 的强大 ；

b）支持动态页面，例如 PHP；

c）支持的模块多，基本涵盖所有应用；

d）性能稳定，而nginx相对bug较多。

 

**3) 两者优缺点比较**

a）Nginx 配置简洁, Apache 复杂 ；

b）Nginx 静态处理性能比 Apache 高 3倍以上 ；

c）Apache 对 PHP 支持比较简单，Nginx 需要配合其他后端用，例如 PHP-FPM；

d）Apache 的组件比 Nginx 多，更加成熟 ；

 

Apache是同步多进程模型，一个连接对应一个进程；

Nginx是异步的，多个连接（万级别）可以对应一个进程；

a）Nginx处理静态文件好，耗费内存少；

b）动态请求由Apache去做，Nginx只适合静态和反向；

c）Nginx适合做前端服务器，负载性能很好；

d）Nginx本身就是一个反向代理服务器 ，且支持负载均衡

 

**3. 总结**

a）Nginx优点：负载均衡、反向代理、处理静态文件优势。Nginx处理静态请求的速度高于apache；

b）Apache优点：相对于Tomcat服务器来说处理静态文件是它的优势，速度快。Apache是静态解析，适合静态HTML、图片等。

c）Tomcat：动态解析容器，处理动态请求，是编译JSP、Servlet的容器，Nginx有动态分离机制，静态请求直接就可以通过Nginx处理，动态请求才转发请求到后台交由Tomcat进行处理。

![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/apache-nginx-tomcat-qu-bie-04.jpeg)

![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/apache-nginx-tomcat-qu-bie-05.jpeg)

 

**Apache在处理动态有优势，Nginx并发性比较好，CPU内存占用低，**

**如果rewrite频繁，那还是Apache较适合。**

 

**反向代理的理解：**

![img](https://blog.mimvp.com/wp-content/uploads/2018/10/zheng-xiang-dai-li-fan-xiang-dai-li-tou-ming-dai-li-de-tu-wen-xiang-jie-00-564x700.png)

反向代理（Reverse Proxy）方式是指以代理服务器来接受internet上的连接请求，然后将请求转发给内部网络上的服务器处理，其本身并不做处理，并将从服务器上得到的结果返回给internet上请求连接的客户端，此时代理服务器对外就表现为一个web服务器，实际只做了转发，Nginx转发给了后台Tomcat或PHP-FPM服务器来处理的，Nginx本身并没有做处理。

![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/apache-nginx-tomcat-qu-bie-06.jpeg)

![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/apache-nginx-tomcat-qu-bie-07.jpeg)

![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/apache-nginx-tomcat-qu-bie-08.jpeg)